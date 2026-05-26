import { KdCalculatorService } from './kd-calculator.service';

describe('KdCalculatorService', () => {
  const svc = new KdCalculatorService();

  it('returns 0-100 with notes', () => {
    const r = svc.compute({ keyword: 'seo', volume: 80_000, competition: 'high' });
    expect(r.kd).toBeGreaterThanOrEqual(0);
    expect(r.kd).toBeLessThanOrEqual(100);
    expect(r.notes.length).toBeGreaterThan(0);
  });

  it('rates head terms with high volume as hard', () => {
    const r = svc.compute({ keyword: 'seo', volume: 100_000, competition: 'high' });
    expect(r.kd).toBeGreaterThan(70);
    expect(r.notes).toEqual(expect.arrayContaining([expect.stringMatching(/Volume rất cao/)]));
  });

  it('rates long-tail info queries as easier', () => {
    const r = svc.compute({
      keyword: 'seo là gì và cách bắt đầu cho người mới',
      volume: 200,
      competition: 'low',
    });
    expect(r.kd).toBeLessThan(35);
    expect(r.notes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Long-tail/),
        expect.stringMatching(/Easy qualifier/),
      ]),
    );
  });

  it('tags hard qualifiers like "best" / "tốt nhất"', () => {
    const r = svc.compute({
      keyword: 'best SEO tools 2026',
      volume: 5000,
      competition: 'medium',
    });
    expect(r.notes).toEqual(expect.arrayContaining([expect.stringMatching(/Hard qualifier/)]));
  });

  it('handles missing volume gracefully', () => {
    const r = svc.compute({ keyword: 'some keyword', volume: null, competition: null });
    expect(r.kd).toBeGreaterThanOrEqual(0);
    expect(r.notes).toEqual(
      expect.arrayContaining([expect.stringMatching(/Không có volume data/)]),
    );
  });
});
