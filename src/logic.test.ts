import { describe, it, expect } from 'vitest';
import { outfit, tip, summarize, PeriodWx } from './logic';
const P = (o: Partial<PeriodWx>): PeriodWx => ({ label: 'x', feelsMin: 10, feelsMax: 10, temp: 10, pop: 0, rainMm: 0, snowCm: 0, windMax: 5, uvMax: 1, code: 1, ...o });
const keys = (p: PeriodWx, b = 0) => outfit(p, b).map((i) => i.key);
describe('outfit', () => {
  it('deep cold', () => expect(keys(P({ feelsMin: -18, feelsMax: -12, code: 3 }))).toEqual(['winterCoat','snowPants','tuque','mittens','neckWarmer','winterBoots']));
  it('snowy just below zero', () => expect(keys(P({ feelsMin: -3, snowCm: 2, code: 73 }))).toContain('snowPants'));
  it('cool and rainy', () => { const k = keys(P({ feelsMin: 9, pop: 80, rainMm: 3, code: 63 })); expect(k).toContain('raincoat'); expect(k).toContain('rainBoots'); expect(k).not.toContain('sneakers'); });
  it('mild', () => expect(keys(P({ feelsMin: 16, feelsMax: 18 }))).toEqual(['sweater','longPants','sneakers']));
  it('hot sunny', () => expect(keys(P({ feelsMin: 22, feelsMax: 28, uvMax: 8 }))).toEqual(['tshirt','shorts','sneakers','cap','sunscreen']));
  it('cold bias shifts', () => expect(keys(P({ feelsMin: 14, feelsMax: 15 }), 2)).toContain('lightJacket'));
  it('tip for swing', () => expect(tip(P({ feelsMin: 2 }), P({ feelsMax: 14 }))).toMatch(/layers/));
});
describe('summarize', () => {
  it('picks the window of the day', () => {
    const time = Array.from({ length: 48 }, (_, i) => `2026-09-${i < 24 ? 26 : 27}T${String(i % 24).padStart(2, '0')}:00`);
    const n = (f: (i: number) => number) => time.map((_, i) => f(i));
    const h = { time, temperature_2m: n((i) => i % 24), apparent_temperature: n((i) => (i % 24) - 2), precipitation_probability: n((i) => (i % 24 === 8 ? 70 : 10)), precipitation: n(() => 0), snowfall: n(() => 0), weather_code: n((i) => (i % 24 === 8 ? 61 : 1)), wind_speed_10m: n(() => 10), uv_index: n(() => 2) };
    const m = summarize(h, '2026-09-27', 7, 9, 'Morning')!;
    expect(m.feelsMin).toBe(5); expect(m.pop).toBe(70); expect(m.code).toBe(61);
  });
});
describe('warm rain', () => { it('no double coat', () => { const k = outfit({ label:'x', feelsMin: 4, feelsMax: 6, temp: 6, pop: 90, rainMm: 4, snowCm: 0, windMax: 5, uvMax: 1, code: 63 }).map(i=>i.label); expect(k.filter(l=>/coat|jacket/i.test(l))).toEqual(['Warm raincoat']); }); });
import { schoolPlan } from './logic';
describe('school plan', () => {
  it('rain after lunch: rain boots worn, raincoat packed, socks', () => {
    const p = schoolPlan(P({ feelsMin: 15, feelsMax: 16 }), P({ feelsMin: 15, feelsMax: 17, pop: 80, rainMm: 3, code: 63 }));
    expect(p.wear.map(i=>i.key)).toContain('rainBoots');
    expect(p.wear.map(i=>i.key)).not.toContain('sneakers');
    expect(p.pack.map(i=>i.key)).toEqual(expect.arrayContaining(['raincoat','spareSocks']));
  });
  it('cold morning warm afternoon: note to take off', () => {
    const p = schoolPlan(P({ feelsMin: 4, feelsMax: 6 }), P({ feelsMin: 19, feelsMax: 22 }));
    expect(p.note).toMatch(/tuque/);
    expect(p.pack).toEqual([]);
  });
  it('hot day: water bottle, sunscreen packed if only afternoon', () => {
    const p = schoolPlan(P({ feelsMin: 17, feelsMax: 18, uvMax: 3 }), P({ feelsMin: 24, feelsMax: 29, uvMax: 8 }));
    expect(p.pack.map(i=>i.key)).toEqual(expect.arrayContaining(['cap','sunscreen','water']));
  });
});
describe('one coat', () => { it('rain later swaps jacket for raincoat', () => {
  const p = schoolPlan(P({ feelsMin: 4, feelsMax: 6 }), P({ feelsMin: 11, feelsMax: 14, pop: 80, rainMm: 3, code: 63 }));
  expect(p.wear.map(i=>i.label)).toContain('Warm raincoat');
  expect(p.pack.map(i=>i.key)).not.toContain('raincoat');
}); });
describe('no lighter substitutes packed', () => { it('warm jacket morning, light jacket afternoon', () => {
  const p = schoolPlan(P({ feelsMin: 8, feelsMax: 9 }), P({ feelsMin: 14, feelsMax: 18 }), 2);
  expect(p.pack.map(i=>i.key)).not.toContain('lightJacket');
  expect(p.pack.map(i=>i.key)).not.toContain('sweater');
  expect(p.wear.map(i=>i.key)).toContain('sweater');
  expect(p.note ?? '').not.toMatch(/jacket/);
}); });
