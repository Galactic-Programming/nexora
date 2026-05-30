import { BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadPurpose } from './dto/create-signed-upload-url.dto';
import { UploadsService } from './uploads.service';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

/**
 * Builds a fake `SupabaseClient` whose `.storage.from(...).createSignedUploadUrl(...)`
 * returns whatever the test wants. We never hit Supabase from unit tests.
 */
function fakeSupabase(createSignedUploadUrl: jest.Mock): {
  storage: { from: jest.Mock };
} {
  return {
    storage: {
      from: jest.fn(() => ({ createSignedUploadUrl })),
    },
  };
}

function makeConfig(
  values: Record<string, string> = {
    'supabase.url': 'https://test.supabase.co',
    'supabase.serviceRoleKey': 'svc-role-key',
    'supabase.storageBucket': 'tourism-assets',
  },
): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      const v = values[key];
      if (v === undefined) throw new Error(`missing config: ${key}`);
      return v;
    }),
  } as unknown as ConfigService;
}

/**
 * Bypasses `onModuleInit` (which constructs a real Supabase client) by
 * injecting the fake directly. Lets us test path derivation + error
 * mapping without touching the network.
 */
function buildSvc(createSignedUploadUrl: jest.Mock) {
  const svc = new UploadsService(makeConfig());
  Object.assign(svc as unknown as Record<string, unknown>, {
    supabase: fakeSupabase(createSignedUploadUrl),
    bucket: 'tourism-assets',
  });
  return svc;
}

/** Cast `mock.calls` to a typed `[string]` argv so we can index safely. */
function firstPathArg(spy: jest.Mock): string {
  const calls = spy.mock.calls as unknown as [string][];
  return calls[0][0];
}

describe('UploadsService', () => {
  describe('createSignedUploadUrl', () => {
    it('routes TOUR_HERO into the tours/hero folder with timestamp prefix', async () => {
      const createSignedUploadUrl = jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed', token: 'tok', path: 'ignored' },
        error: null,
      });
      const svc = buildSvc(createSignedUploadUrl);

      const result = await svc.createSignedUploadUrl({
        purpose: UploadPurpose.TOUR_HERO,
        filename: 'My Hero Shot.JPG',
      });

      const pathArg = firstPathArg(createSignedUploadUrl);
      expect(pathArg).toMatch(/^tours\/hero\/\d+-my-hero-shot\.jpg$/);
      expect(result.bucket).toBe('tourism-assets');
      expect(result.uploadUrl).toBe('https://signed');
      expect(result.token).toBe('tok');
    });

    it('maps every purpose to its declared folder', async () => {
      const expectations: Array<[UploadPurpose, RegExp]> = [
        [UploadPurpose.TOUR_GALLERY, /^tours\/gallery\//],
        [UploadPurpose.DESTINATION_HERO, /^destinations\/hero\//],
        [UploadPurpose.USER_AVATAR, /^users\/avatars\//],
      ];

      for (const [purpose, folderRe] of expectations) {
        const spy = jest.fn().mockResolvedValue({
          data: { signedUrl: 'u', token: 't', path: 'p' },
          error: null,
        });
        const svc = buildSvc(spy);
        await svc.createSignedUploadUrl({ purpose, filename: 'x.png' });

        expect(firstPathArg(spy)).toMatch(folderRe);
      }
    });

    it('strips path-traversal attempts and collapses unsafe chars in the stem', async () => {
      const createSignedUploadUrl = jest.fn().mockResolvedValue({
        data: { signedUrl: 'u', token: 't', path: 'p' },
        error: null,
      });
      const svc = buildSvc(createSignedUploadUrl);

      // Bypass DTO regex (the controller already enforces it) — exercise the
      // service's own defence-in-depth sanitization.
      await svc.createSignedUploadUrl({
        purpose: UploadPurpose.TOUR_GALLERY,
        filename: '../../../etc/passwd.PNG',
      });

      const pathArg = firstPathArg(createSignedUploadUrl);
      expect(pathArg).not.toContain('..');
      expect(pathArg).not.toContain('/etc/');
      // Final segment should be `<ts>-passwd.png`.
      expect(pathArg).toMatch(/^tours\/gallery\/\d+-passwd\.png$/);
    });

    it('wraps Supabase Storage errors as 502 STORAGE_SIGN_FAILED', async () => {
      const createSignedUploadUrl = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'bucket not found' },
      });
      const svc = buildSvc(createSignedUploadUrl);

      await expect(
        svc.createSignedUploadUrl({
          purpose: UploadPurpose.TOUR_HERO,
          filename: 'a.jpg',
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
      await expect(
        svc.createSignedUploadUrl({
          purpose: UploadPurpose.TOUR_HERO,
          filename: 'a.jpg',
        }),
      ).rejects.toMatchObject({ response: { code: 'STORAGE_SIGN_FAILED' } });
    });
  });
});
