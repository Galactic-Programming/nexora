import { slugify } from './slugify';

describe('slugify', () => {
  it('strips Vietnamese diacritics and lowercases', () => {
    expect(slugify('Hội An')).toBe('hoi-an');
    expect(slugify('Đà Nẵng')).toBe('da-nang'); // đ/Đ do NOT decompose via NFD
    expect(slugify('ĐIỆN BIÊN PHỦ')).toBe('dien-bien-phu');
  });

  it('normalises whitespace, symbols, and separators to single hyphens', () => {
    expect(slugify('  Đà   Nẵng/Huế ')).toBe('da-nang-hue');
    expect(slugify('Sa Pa — Trek & Homestay!')).toBe('sa-pa-trek-homestay');
    expect(slugify('hoi_an.walking.tour')).toBe('hoi-an-walking-tour');
  });

  it('keeps digits and already-valid slugs unchanged', () => {
    expect(slugify('Hội An 2024')).toBe('hoi-an-2024');
    expect(slugify('hoi-an-walking-tour')).toBe('hoi-an-walking-tour');
  });

  it('trims leading/trailing hyphens produced by edge symbols', () => {
    expect(slugify('--Hà Nội--')).toBe('ha-noi');
    expect(slugify('!!!')).toBe(''); // symbol-only input → empty (caller decides)
  });

  it('always emits the canonical kebab format the DTO regex accepts', () => {
    const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const samples = [
      'Hội An',
      'Phú Quốc 3 Đảo',
      'TOUR  ĐẶC BIỆT (hè 2026)!!',
      'mixed_CASE---input',
    ];
    for (const s of samples) {
      expect(slugify(s)).toMatch(KEBAB);
    }
  });
});
