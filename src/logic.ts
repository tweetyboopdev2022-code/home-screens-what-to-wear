// Pure outfit logic for the What to Wear plugin. All temperatures in °C.

export interface Hourly {
  time: string[]; // local ISO "2026-09-26T07:00"
  temperature_2m: number[];
  apparent_temperature: number[];
  precipitation_probability: (number | null)[];
  precipitation: number[];
  snowfall: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  uv_index?: number[];
}

export interface PeriodWx {
  label: string;
  feelsMin: number;
  feelsMax: number;
  temp: number; // representative actual temp (mean)
  pop: number; // max precipitation probability %
  rainMm: number;
  snowCm: number;
  windMax: number; // km/h
  uvMax: number;
  code: number; // most severe weather code in window
}

export interface Item { icon: string; label: string; key: string }

export function summarize(h: Hourly, day: string, fromHour: number, toHour: number, label: string): PeriodWx | null {
  const idx: number[] = [];
  h.time.forEach((t, i) => {
    if (!t.startsWith(day)) return;
    const hr = Number(t.slice(11, 13));
    if (hr >= fromHour && hr <= toHour) idx.push(i);
  });
  if (!idx.length) return null;
  const pick = (a: (number | null)[] | undefined) => idx.map((i) => Number(a?.[i] ?? 0));
  const feels = pick(h.apparent_temperature);
  const temps = pick(h.temperature_2m);
  const codes = pick(h.weather_code);
  return {
    label,
    feelsMin: Math.min(...feels),
    feelsMax: Math.max(...feels),
    temp: temps.reduce((a, b) => a + b, 0) / temps.length,
    pop: Math.max(...pick(h.precipitation_probability)),
    rainMm: pick(h.precipitation).reduce((a, b) => a + b, 0),
    snowCm: pick(h.snowfall).reduce((a, b) => a + b, 0),
    windMax: Math.max(...pick(h.wind_speed_10m)),
    uvMax: Math.max(...pick(h.uv_index)),
    code: codes.reduce((a, b) => (severity(b) > severity(a) ? b : a), codes[0]),
  };
}

function severity(code: number): number {
  if (code >= 95) return 9;
  if (code >= 71 && code <= 86 && code !== 80 && code !== 81 && code !== 82) return 8;
  if (code >= 61) return 7;
  if (code >= 51) return 6;
  if (code >= 45) return 4;
  return code; // 0..3
}

export function sky(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Sunny' };
  if (code <= 2) return { icon: '🌤️', label: 'Some clouds' };
  if (code === 3) return { icon: '☁️', label: 'Cloudy' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Foggy' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { icon: '🌧️', label: 'Rain' };
  if (code >= 71 && code <= 77) return { icon: '🌨️', label: 'Snow' };
  if (code >= 80 && code <= 82) return { icon: '🌦️', label: 'Showers' };
  if (code === 85 || code === 86) return { icon: '🌨️', label: 'Snow showers' };
  if (code >= 95) return { icon: '⛈️', label: 'Storm' };
  return { icon: '☁️', label: '' };
}

const I = {
  winterCoat: { key: 'winterCoat', icon: '🧥', label: 'Winter coat' },
  snowPants: { key: 'snowPants', icon: '👖', label: 'Snow pants' },
  tuque: { key: 'tuque', icon: '🧶', label: 'Tuque' },
  mittens: { key: 'mittens', icon: '🧤', label: 'Mittens' },
  neckWarmer: { key: 'neckWarmer', icon: '🧣', label: 'Neck warmer' },
  winterBoots: { key: 'winterBoots', icon: '🥾', label: 'Winter boots' },
  warmJacket: { key: 'warmJacket', icon: '🧥', label: 'Warm jacket' },
  lightGloves: { key: 'lightGloves', icon: '🧤', label: 'Light gloves' },
  lightJacket: { key: 'lightJacket', icon: '🧥', label: 'Light jacket' },
  sweater: { key: 'sweater', icon: '🧶', label: 'Sweater' },
  longPants: { key: 'longPants', icon: '👖', label: 'Long pants' },
  tshirt: { key: 'tshirt', icon: '👕', label: 'T-shirt' },
  shorts: { key: 'shorts', icon: '🩳', label: 'Shorts' },
  raincoat: { key: 'raincoat', icon: '🧥', label: 'Raincoat' },
  warmRaincoat: { key: 'raincoat', icon: '🧥', label: 'Warm raincoat' },
  rainBoots: { key: 'rainBoots', icon: '👢', label: 'Rain boots' },
  umbrella: { key: 'umbrella', icon: '☂️', label: 'Umbrella' },
  cap: { key: 'cap', icon: '🧢', label: 'Cap' },
  sunscreen: { key: 'sunscreen', icon: '🧴', label: 'Sunscreen' },
  windbreaker: { key: 'windbreaker', icon: '💨', label: 'Windproof layer' },
  sneakers: { key: 'sneakers', icon: '👟', label: 'Running shoes' },
} satisfies Record<string, Item>;

/** The outfit for one part of the day. `coldBias` shifts thresholds (kids feel cold faster: default +2). */
export function outfit(p: PeriodWx, coldBias = 0): Item[] {
  const f = p.feelsMin - coldBias;
  const wet = p.pop >= 50 || p.rainMm >= 1;
  const snowy = p.snowCm >= 0.5 || (p.code >= 71 && p.code <= 86 && p.code !== 80 && p.code !== 81 && p.code !== 82);
  const out: Item[] = [];
  if (f <= -10) out.push(I.winterCoat, I.snowPants, I.tuque, I.mittens, I.neckWarmer, I.winterBoots);
  else if (f <= 0) out.push(I.winterCoat, I.snowPants, I.tuque, I.mittens, I.winterBoots);
  else if (f <= 7) out.push(wet ? I.warmRaincoat : I.warmJacket, I.tuque, I.lightGloves, I.longPants);
  else if (f <= 13) out.push(wet ? I.raincoat : I.lightJacket, I.sweater, I.longPants);
  else if (f <= 18) out.push(I.sweater, I.longPants);
  else if (p.feelsMax >= 24) out.push(I.tshirt, I.shorts);
  else out.push(I.tshirt, I.longPants);

  if (snowy && f > 0) out.push(I.winterBoots);
  if (wet && !snowy && f > 0) {
    if (!out.some((x) => x.key === 'raincoat')) out.push(I.raincoat);
    out.push(I.rainBoots);
  }
  if (!out.some((x) => x.key === 'winterBoots' || x.key === 'rainBoots')) out.push(I.sneakers);
  if (p.windMax >= 35 && f > 0 && f <= 18) out.push(I.windbreaker);
  if (p.uvMax >= 6 && f > 13) out.push(I.cap, I.sunscreen);
  return dedupe(out);
}

function dedupe(items: Item[]): Item[] {
  const seen = new Set<string>();
  return items.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
}

/** A one-line tip for the day. */
export function tip(morning: PeriodWx | null, afternoon: PeriodWx | null): string {
  if (morning && afternoon) {
    const swing = afternoon.feelsMax - morning.feelsMin;
    if (swing >= 8) return 'Cold morning, warmer afternoon — wear layers you can take off.';
    if (afternoon.pop >= 50 && morning.pop < 40) return 'Dry this morning, but pack rain gear for later.';
    if (morning.pop >= 50 && afternoon.pop < 40) return 'Rainy morning, drier afternoon.';
  }
  const any = [morning, afternoon].filter(Boolean) as PeriodWx[];
  if (any.some((p) => p.snowCm >= 0.5)) return 'Snow today — keep boots and mittens on at recess!';
  if (any.some((p) => p.pop >= 50)) return 'Rain likely — splash-proof day!';
  if (any.some((p) => p.uvMax >= 6)) return 'Strong sun — cap and sunscreen.';
  return 'Have a great day!';
}

const EXTRA = {
  spareSocks: { key: 'spareSocks', icon: '🧦', label: 'Spare socks' },
  water: { key: 'water', icon: '💧', label: 'Water bottle' },
} satisfies Record<string, Item>;

const PACKABLE = new Set(['raincoat', 'rainBoots', 'umbrella', 'cap', 'sunscreen', 'sweater', 'lightJacket', 'warmJacket', 'tuque', 'lightGloves', 'mittens', 'snowPants', 'winterBoots', 'windbreaker', 'neckWarmer']);
const REMOVABLE = new Set(['tuque', 'lightGloves', 'mittens', 'warmJacket', 'winterCoat', 'sweater', 'neckWarmer', 'lightJacket', 'raincoat']);

export interface SchoolPlan { wear: Item[]; pack: Item[]; note?: string }

/** One plan for the whole school day: what to put on in the morning, and what goes in the backpack. */
export function schoolPlan(morning: PeriodWx | null, afternoon: PeriodWx | null, coldBias = 0): SchoolPlan {
  const m = morning ?? afternoon; const a = afternoon ?? morning;
  if (!m || !a) return { wear: [], pack: [] };
  const wear = outfit(m, coldBias);
  const later = outfit(a, coldBias);
  const has = (list: Item[], k: string) => list.some((x) => x.key === k);
  // Rain later: wear the raincoat instead of the jacket so there's only one coat to manage.
  if (has(later, 'raincoat') && !has(wear, 'raincoat')) {
    const j = wear.findIndex((x) => x.key === 'warmJacket' || x.key === 'lightJacket');
    if (j >= 0) wear.splice(j, 1, wear[j].key === 'warmJacket' ? I.warmRaincoat : I.raincoat);
  }
  const COATS = new Set(['winterCoat', 'warmJacket', 'lightJacket', 'raincoat']);
  const LAYERS = new Set(['sweater']);
  const wearsCoat = wear.some((x) => COATS.has(x.key));
  // Layers needed later go on underneath from the start rather than in the backpack.
  for (const x of later) if (LAYERS.has(x.key) && !has(wear, x.key)) wear.splice(Math.min(1, wear.length), 0, x);
  const pack: Item[] = later.filter((x) => PACKABLE.has(x.key) && !has(wear, x.key)
    && !(wearsCoat && COATS.has(x.key)) && !LAYERS.has(x.key));
  // Boots: if rain or snow later, wear the right boots from the start (kids won't change shoes).
  for (const k of ['rainBoots', 'winterBoots']) {
    const i = pack.findIndex((x) => x.key === k);
    if (i >= 0) { const [boot] = pack.splice(i, 1); const s = wear.findIndex((x) => x.key === 'sneakers'); if (s >= 0) wear.splice(s, 1, boot); else wear.push(boot); }
  }
  const wetOrSnowy = [m, a].some((p) => p.pop >= 60 || p.rainMm >= 1 || p.snowCm >= 0.5);
  if (wetOrSnowy) pack.push(EXTRA.spareSocks);
  if (Math.max(m.feelsMax, a.feelsMax) >= 25) pack.push(EXTRA.water);
  const laterHasCoat = later.some((x) => COATS.has(x.key));
  const offLater = wear.filter((x) => REMOVABLE.has(x.key) && !has(later, x.key) && !(COATS.has(x.key) && laterHasCoat));
  let note: string | undefined;
  if (offLater.length) note = `Warmer after lunch — ${joinLabels(offLater)} can go in the backpack.`;
  else if (a.feelsMin < m.feelsMin - 4) note = 'Colder this afternoon — keep the extra layer handy.';
  return { wear, pack, note };
}

function joinLabels(items: Item[]): string {
  const l = items.map((x) => x.label.toLowerCase());
  return l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
}

export interface HourPoint { hour: number; temp: number; code: number; pop: number }
export function hourPoints(h: Hourly, day: string, hours: number[]): HourPoint[] {
  return hours.map((hr) => {
    const i = h.time.findIndex((t) => t.startsWith(day) && Number(t.slice(11, 13)) === hr);
    return i < 0 ? null : { hour: hr, temp: h.temperature_2m[i], code: h.weather_code[i], pop: Number(h.precipitation_probability[i] ?? 0) };
  }).filter(Boolean) as HourPoint[];
}
