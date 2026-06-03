import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadPurpose } from './dto/create-signed-upload-url.dto';
import { ResourceType, UploadsService } from './uploads.service';

// Mock the Cloudinary SDK — unit tests never hit the network or do real crypto.
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: {
      api_sign_request: jest.fn(() => 'fake-signature'),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { v2: cloudinary } = require('cloudinary') as {
  v2: {
    config: jest.Mock;
    utils: { api_sign_request: jest.Mock };
  };
};

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

const CONFIG_VALUES: Record<string, string> = {
  'cloudinary.cloudName': 'demo-cloud',
  'cloudinary.apiKey': 'demo-key',
  'cloudinary.apiSecret': 'demo-secret',
  'cloudinary.uploadFolder': 'tourism',
};

function makeConfig(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      const v = CONFIG_VALUES[key];
      if (v === undefined) throw new Error(`missing config: ${key}`);
      return v;
    }),
  } as unknown as ConfigService;
}

/** Builds a fully-initialised service (runs onModuleInit against the mock). */
function buildSvc(): UploadsService {
  const svc = new UploadsService(makeConfig());
  svc.onModuleInit();
  return svc;
}

/** Runs `fn`, returning the thrown error (or fails if nothing was thrown). */
function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected function to throw, but it did not');
}

/** Typed accessor for the params passed to the mocked api_sign_request. */
function signedParams(): Record<string, unknown> {
  const calls = cloudinary.utils.api_sign_request.mock.calls as unknown as [
    Record<string, unknown>,
    string,
  ][];
  return calls[calls.length - 1][0];
}

describe('UploadsService', () => {
  beforeEach(() => {
    cloudinary.utils.api_sign_request.mockClear();
    cloudinary.config.mockClear();
  });

  describe('createSignedUploadParams', () => {
    it('configures the Cloudinary SDK on init', () => {
      buildSvc();
      expect(cloudinary.config).toHaveBeenCalledWith(
        expect.objectContaining({
          cloud_name: 'demo-cloud',
          api_key: 'demo-key',
          api_secret: 'demo-secret',
          secure: true,
        }),
      );
    });

    it('routes TOUR_HERO into tours/hero with an image resource type and ext-less public_id', () => {
      const svc = buildSvc();

      const result = svc.createSignedUploadParams({
        purpose: UploadPurpose.TOUR_HERO,
        filename: 'My Hero Shot.JPG',
      });

      expect(result.folder).toBe('tourism/tours/hero');
      expect(result.resourceType).toBe('image');
      expect(result.publicId).toMatch(/^\d+-my-hero-shot$/);
      expect(result.publicId).not.toContain('.jpg');
      expect(result.signature).toBe('fake-signature');
      expect(result.apiKey).toBe('demo-key');
      expect(result.cloudName).toBe('demo-cloud');
      expect(result.uploadUrl).toBe(
        'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
      );
    });

    it('signs exactly { folder, public_id, timestamp }', () => {
      const svc = buildSvc();

      svc.createSignedUploadParams({
        purpose: UploadPurpose.TOUR_GALLERY,
        filename: 'shot.png',
      });

      const params = signedParams();
      expect(Object.keys(params).sort()).toEqual([
        'folder',
        'public_id',
        'timestamp',
      ]);
      expect(params.folder).toBe('tourism/tours/gallery');
      expect(typeof params.timestamp).toBe('number');
    });

    it('maps each purpose to its folder and resource type', () => {
      const svc = buildSvc();
      const cases: Array<[UploadPurpose, string, ResourceType, string]> = [
        [UploadPurpose.TOUR_GALLERY, 'tourism/tours/gallery', 'image', 'a.png'],
        [UploadPurpose.TOUR_VIDEO, 'tourism/tours/video', 'video', 'a.mp4'],
        [
          UploadPurpose.DESTINATION_HERO,
          'tourism/destinations/hero',
          'image',
          'a.webp',
        ],
        [
          UploadPurpose.DESTINATION_VIDEO,
          'tourism/destinations/video',
          'video',
          'a.webm',
        ],
        [UploadPurpose.USER_AVATAR, 'tourism/users/avatars', 'image', 'a.png'],
      ];

      for (const [purpose, folder, resourceType, filename] of cases) {
        const result = svc.createSignedUploadParams({ purpose, filename });
        expect(result.folder).toBe(folder);
        expect(result.resourceType).toBe(resourceType);
      }
    });

    it('rejects a video file submitted for an image purpose (400)', () => {
      const svc = buildSvc();

      expect(() =>
        svc.createSignedUploadParams({
          purpose: UploadPurpose.TOUR_HERO,
          filename: 'clip.mp4',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects an image file submitted for a video purpose (400)', () => {
      const svc = buildSvc();

      expect(() =>
        svc.createSignedUploadParams({
          purpose: UploadPurpose.TOUR_VIDEO,
          filename: 'poster.jpg',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects a disallowed extension with MEDIA_FORMAT_REJECTED', () => {
      const svc = buildSvc();

      const err = captureError(() =>
        svc.createSignedUploadParams({
          purpose: UploadPurpose.TOUR_GALLERY,
          filename: 'malware.exe',
        }),
      );
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'MEDIA_FORMAT_REJECTED',
      });
    });

    it('rejects a contentType whose major type disagrees with the purpose', () => {
      const svc = buildSvc();

      const err = captureError(() =>
        svc.createSignedUploadParams({
          purpose: UploadPurpose.TOUR_HERO,
          filename: 'photo.png',
          contentType: 'video/mp4',
        }),
      );
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'MEDIA_FORMAT_REJECTED',
      });
    });

    it('strips path-traversal attempts when deriving the public_id', () => {
      const svc = buildSvc();

      const result = svc.createSignedUploadParams({
        purpose: UploadPurpose.TOUR_GALLERY,
        filename: '../../../etc/passwd.PNG',
      });

      expect(result.publicId).not.toContain('..');
      expect(result.publicId).not.toContain('/');
      expect(result.publicId).toMatch(/^\d+-passwd$/);
    });
  });
});
