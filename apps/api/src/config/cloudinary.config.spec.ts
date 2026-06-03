import { cloudinaryConfig } from './cloudinary.config';

/**
 * Unit tests for the `cloudinary.*` config factory.
 *
 * The factory reads `process.env` at call time, so each test snapshots and
 * restores the env to stay isolated (AAA pattern).
 */
describe('cloudinaryConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Fresh copy per test so mutations don't leak across cases.
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('maps required Cloudinary env vars onto the namespace', () => {
    // Arrange
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    process.env.CLOUDINARY_API_KEY = '123456789012345';
    process.env.CLOUDINARY_API_SECRET = 'super-secret';
    process.env.CLOUDINARY_UPLOAD_FOLDER = 'tourism-test';

    // Act
    const config = cloudinaryConfig();

    // Assert
    expect(config).toEqual({
      cloudName: 'demo-cloud',
      apiKey: '123456789012345',
      apiSecret: 'super-secret',
      uploadFolder: 'tourism-test',
    });
  });

  it('falls back to the default upload folder when unset', () => {
    // Arrange
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    process.env.CLOUDINARY_API_KEY = '123456789012345';
    process.env.CLOUDINARY_API_SECRET = 'super-secret';
    delete process.env.CLOUDINARY_UPLOAD_FOLDER;

    // Act
    const config = cloudinaryConfig();

    // Assert
    expect(config.uploadFolder).toBe('tourism');
  });
});
