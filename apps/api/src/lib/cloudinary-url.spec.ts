import { MediaType } from '@prisma/client';
import { buildCloudinaryUrl } from './cloudinary-url';

describe('buildCloudinaryUrl', () => {
  const CLOUD = 'demo-cloud';

  it('builds an image URL with f_auto,q_auto and no poster', () => {
    const result = buildCloudinaryUrl(CLOUD, {
      type: MediaType.IMAGE,
      publicId: 'tourism/tours/hero/123-hoi-an',
    });

    expect(result.url).toBe(
      'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/tourism/tours/hero/123-hoi-an',
    );
    expect(result.posterUrl).toBeUndefined();
  });

  it('builds a video URL with a derived first-frame poster', () => {
    const result = buildCloudinaryUrl(CLOUD, {
      type: MediaType.VIDEO,
      publicId: 'tourism/tours/video/123-clip',
    });

    expect(result.url).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/tourism/tours/video/123-clip',
    );
    expect(result.posterUrl).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/so_0/tourism/tours/video/123-clip.jpg',
    );
  });

  it('prefers a dedicated posterId image when present', () => {
    const result = buildCloudinaryUrl(CLOUD, {
      type: MediaType.VIDEO,
      publicId: 'tourism/tours/video/123-clip',
      posterId: 'tourism/tours/video/123-poster',
    });

    expect(result.posterUrl).toBe(
      'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/tourism/tours/video/123-poster',
    );
  });
});
