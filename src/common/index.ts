/**
 * Public barrel for the cross-cutting `common/` layer.
 *
 * Anything reusable across feature modules (envelope types, decorators,
 * guards, filter, interceptor) is re-exported here so feature modules can
 * import from `'../common'` instead of deep paths.
 */
export * from './types/api-response';
export * from './types/authenticated-request';
export * from './decorators/public.decorator';
export * from './decorators/roles.decorator';
export * from './decorators/current-user.decorator';
export * from './decorators/skip-transform.decorator';
export * from './guards/supabase-jwt.guard';
export * from './guards/roles.guard';
export * from './filters/http-exception.filter';
export * from './interceptors/transform.interceptor';
