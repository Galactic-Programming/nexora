import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  errors as joseErrors,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyResult,
} from 'jose';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type {
  AuthenticatedRequest,
  SupabaseAuthIdentity,
} from '../types/authenticated-request';

/**
 * Global guard that verifies a Supabase JWT in the `Authorization` header
 * and attaches the resulting identity (+ matching local user row) to the
 * request.
 *
 * Why this design?
 * - Supabase issues access tokens AT THE FRONTEND (post sign-in/up). The BE
 *   must not trust the FE blindly — it has to verify cryptographically.
 * - Supabase 2025+ uses asymmetric signing (ES256/RS256/EdDSA) with a public
 *   JWKS endpoint, so the BE never needs a shared secret. Older projects
 *   that still issue HS256 tokens are supported via the legacy fallback.
 * - We attach the local DB row (`req.currentUser`) here so downstream
 *   handlers don't each have to look up the user by `supabaseId`.
 *
 * Pipeline order: this guard runs BEFORE `RolesGuard`. Routes annotated
 * with `@Public()` short-circuit and are not authenticated.
 */
@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseJwtGuard.name);

  /**
   * Lazy JWKS fetcher with built-in caching. `jose` re-uses cached keys for
   * `cacheMaxAge` ms and rate-limits forced refreshes by `cooldownDuration`
   * (protects against a malicious client spamming unknown `kid` values).
   */
  private readonly remoteJwks: ReturnType<typeof createRemoteJWKSet>;

  /**
   * HS256 symmetric key bytes. `null` when no legacy secret is configured —
   * the only correct state for a modern Supabase project.
   */
  private readonly hsKey: Uint8Array | null;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwksUrl = this.config.getOrThrow<string>('supabase.jwksUrl');
    this.remoteJwks = createRemoteJWKSet(new URL(jwksUrl), {
      cacheMaxAge: 10 * 60 * 1000, // 10 min — matches Supabase Edge cache
      cooldownDuration: 30 * 1000, // 30s between forced re-fetches
    });

    const hsSecret = this.config.get<string>('supabase.jwtSecret') ?? '';
    this.hsKey = hsSecret
      ? new Uint8Array(Buffer.from(hsSecret, 'utf8'))
      : null;
  }

  /**
   * NestJS hook invoked for every incoming request on a guarded route.
   *
   * Decision tree:
   *  1. `@Public()` → allow without inspecting headers.
   *  2. No `Authorization: Bearer <jwt>` → 401 `UNAUTHORIZED`.
   *  3. JWT verification fails (signature, expiry, alg mismatch) → 401.
   *  4. JWT lacks `sub` or `email` claim → 401.
   *  5. Otherwise: attach `supabaseUser` + (possibly null) `currentUser`
   *     to the request and allow.
   *
   * @param context  NestJS execution context, narrowed to HTTP.
   * @returns        `true` to allow the request through.
   * @throws UnauthorizedException — with stable `code: 'UNAUTHORIZED'`.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read metadata from BOTH the handler and its parent class so a
    // controller-level @Public() works as well as a method-level one.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header',
      });
    }

    const payload = await this.verifyToken(token);

    // Narrow `unknown` claims to strings before constructing the identity —
    // jose returns `JWTPayload` whose fields are `unknown` until the caller
    // proves their shape.
    const claims = payload as Record<string, unknown>;
    const emailClaim = claims.email;
    const subClaim = payload.sub;
    const identity: SupabaseAuthIdentity = {
      sub: typeof subClaim === 'string' ? subClaim : '',
      email: typeof emailClaim === 'string' ? emailClaim : '',
      emailVerified: Boolean(
        claims.email_verified ?? claims.email_confirmed_at,
      ),
      raw: claims,
    };

    if (!identity.sub) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'JWT missing sub claim',
      });
    }
    if (!identity.email) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'JWT missing email claim',
      });
    }

    // `currentUser` may be null on the first /auth/sync call — that's fine.
    // Controllers that require a synced user must check explicitly.
    req.supabaseUser = identity;
    req.currentUser = await this.prisma.user.findUnique({
      where: { supabaseId: identity.sub },
    });

    return true;
  }

  /**
   * Extracts the bearer token from `Authorization: Bearer <jwt>`.
   *
   * Returns `null` (not an error) when the header is missing or malformed —
   * the caller decides whether that's acceptable (it isn't, for protected
   * routes — but `@Public()` would have skipped this method already).
   *
   * @param req  Express request.
   * @returns    The trimmed token string, or `null`.
   */
  private extractToken(req: AuthenticatedRequest): string | null {
    const header = req.headers.authorization;
    if (!header || typeof header !== 'string') return null;
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
    return value.trim();
  }

  /**
   * Verifies the JWT signature against the right key family.
   *
   * Routing logic:
   * - Decode the unprotected header to read `alg`. (Decoding ≠ trusting —
   *   we only use `alg` to pick a verifier; the verifier itself rejects
   *   mismatches.)
   * - `HS256` → use the configured shared secret if present, else throw a
   *   helpful error so the operator knows what's missing.
   * - Anything else → use the remote JWKS, restricted to the algorithms we
   *   actually accept (`ES256`, `RS256`, `EdDSA`). This whitelist prevents
   *   alg-confusion attacks.
   *
   * Errors from `jose` are mapped to a generic 401 with `code: 'UNAUTHORIZED'`
   * — we DO NOT leak the underlying reason to the client (could aid token
   * forgery). The full reason is logged server-side at WARN level.
   *
   * @param token  Raw bearer token, already extracted from the header.
   * @returns      The verified JWT payload (claim-bag).
   * @throws UnauthorizedException — never any other error type.
   */
  private async verifyToken(token: string): Promise<JWTPayload> {
    let alg: string;
    try {
      alg = decodeProtectedHeader(token).alg ?? '';
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid JWT format',
      });
    }

    try {
      let result: JWTVerifyResult<JWTPayload>;
      if (alg === 'HS256') {
        if (!this.hsKey) {
          throw new UnauthorizedException({
            code: 'UNAUTHORIZED',
            message:
              'HS256 token received but SUPABASE_JWT_SECRET is not configured. ' +
              'Either migrate your project to asymmetric keys or set the legacy secret.',
          });
        }
        result = await jwtVerify(token, this.hsKey, { algorithms: ['HS256'] });
      } else {
        result = await jwtVerify(token, this.remoteJwks, {
          algorithms: ['ES256', 'RS256', 'EdDSA'],
        });
      }
      return result.payload;
    } catch (err) {
      // Re-throw our own 401 untouched; only collapse jose errors into a
      // generic 401 (and log the real reason for ops debugging).
      if (err instanceof UnauthorizedException) throw err;

      const reason =
        err instanceof joseErrors.JOSEError
          ? `${err.code}: ${err.message}`
          : (err as Error).message;
      this.logger.warn(`JWT verification failed (${reason})`);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    }
  }
}
