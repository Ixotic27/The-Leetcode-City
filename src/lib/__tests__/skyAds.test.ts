import { getActiveAds, validateAds, buildAdLink, type SkyAd } from '../skyAds';

const base: Omit<SkyAd, 'id' | 'text' | 'color' | 'bgColor' | 'priority'> = {
  vehicle: 'plane',
};

describe('skyAds utilities (pure)', () => {
  it('validateAds filters invalid hex colors and long text, then sorts by priority desc', () => {
    const ads: SkyAd[] = [
      {
        id: 'a',
        text: 'short',
        color: '#ffffff',
        bgColor: '#000000',
        vehicle: 'plane',
        priority: 1,
      },
      {
        id: 'b',
        text: 'x'.repeat(81),
        color: '#ffffff',
        bgColor: '#000000',
        vehicle: 'plane',
        priority: 999,
      },
      {
        id: 'c',
        text: 'ok',
        color: '#fff',
        bgColor: '#000000',
        vehicle: 'plane',
        priority: 50,
      },
      {
        id: 'd',
        text: 'ok2',
        color: '#ffffff',
        bgColor: '#000000',
        vehicle: 'plane',
        priority: 10,
        link: 'https://example.com',
      },
    ];

    const validated = validateAds(ads);
    expect(validated.map((x) => x.id)).toEqual(['d', 'a']);
  });

  it('validateAds rejects disallowed link protocols', () => {
    const ads: SkyAd[] = [
      {
        id: 'x',
        text: 'ok',
        color: '#ffffff',
        bgColor: '#000000',
        vehicle: 'plane',
        priority: 1,
        link: 'ftp://example.com',
      },
      {
        id: 'y',
        text: 'ok',
        color: '#ffffff',
        bgColor: '#000000',
        vehicle: 'plane',
        priority: 2,
        link: 'mailto:test@example.com',
      },
    ];
    const validated = validateAds(ads);
    expect(validated.map((x) => x.id)).toEqual(['y']);
  });

  it('getActiveAds returns per-vehicle slices respecting max counts', () => {
    const manyPlanes: SkyAd[] = Array.from({ length: 20 }).map((_, i) => ({
      id: `p${i}`,
      text: `plane${i}`,
      color: '#ffffff',
      bgColor: '#000000',
      vehicle: 'plane',
      priority: i,
    }));

    const grouped = getActiveAds(manyPlanes);
    expect(grouped.planeAds).toHaveLength(8);
    // Highest priority first after validateAds sort desc
    expect(grouped.planeAds[0].id).toBe('p19');
  });

  describe('buildAdLink', () => {
    it('returns undefined when link is missing', () => {
      const ad = {
        id: 'a',
        text: 't',
        color: '#ffffff',
        bgColor: '#000000',
        vehicle: 'plane',
        priority: 1,
      } satisfies SkyAd;
      expect(buildAdLink(ad)).toBeUndefined();
    });

    it('keeps mailto links unchanged', () => {
      const ad: SkyAd = {
        id: 'mail',
        text: 't',
        color: '#ffffff',
        bgColor: '#000000',
        vehicle: 'plane',
        priority: 1,
        link: 'mailto:test@example.com',
      };
      expect(buildAdLink(ad)).toBe('mailto:test@example.com');
    });

    it('appends utm params to valid http(s) links', () => {
      const ad: SkyAd = {
        id: 'u1',
        text: 't',
        color: '#ffffff',
        bgColor: '#000000',
        vehicle: 'plane',
        priority: 1,
        link: 'https://example.com/path?x=1',
      };
      const built = buildAdLink(ad)!;
      expect(built).toContain('utm_source=leetcodecity');
      expect(built).toContain('utm_medium=sky_ad');
      expect(built).toContain('utm_campaign=u1');
      expect(built).toContain('utm_content=plane');
      expect(built).toContain('x=1');
    });

    it('returns original link if URL parsing fails', () => {
      const ad: SkyAd = {
        id: 'bad',
        text: 't',
        color: '#ffffff',
        bgColor: '#000000',
        vehicle: 'plane',
        priority: 1,
        link: 'http://[invalid',
      };
      expect(buildAdLink(ad)).toBe('http://[invalid');
    });
  });
});

