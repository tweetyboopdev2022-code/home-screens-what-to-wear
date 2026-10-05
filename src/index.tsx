import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { hostFrameStyle } from './host-style';
import { Hourly, PeriodWx, summarize, sky, schoolPlan, hourPoints, Item } from './logic';

const PLUGIN_ID = 'what-to-wear';
type Props = PluginComponentProps & { units?: string; events?: { title: string; start: string; allDay?: boolean }[] };

function sdk() { return (window as any).__HS_SDK__; }

function localDay(tz: string | undefined, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }).format(d);
}
function localHour(tz: string | undefined): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(new Date()));
}

export default function WhatToWear(props: Props) {
  const { config, style } = props;
  const title = String(config.title ?? 'What to wear');
  const mFrom = Number(config.morningFrom ?? 7), mTo = Number(config.morningTo ?? 9);
  const aFrom = Number(config.afternoonFrom ?? 12), aTo = Number(config.afternoonTo ?? 16);
  const switchHour = Number(config.switchToTomorrowAt ?? 17);
  const coldBias = Number(config.coldBias ?? 2);
  const accent = String(config.accentColor || '#db2777');
  const imperial = props.units === 'imperial';
  const tz = props.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [hourly, setHourly] = React.useState<Hourly | null>(null);
  const [error, setError] = React.useState<string | undefined>();
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 15 * 60000); return () => clearInterval(id); }, []);

  const lat = props.latitude ?? sdk()?.getHostSettings?.()?.latitude;
  const lon = props.longitude ?? sdk()?.getHostSettings?.()?.longitude;

  React.useEffect(() => {
    if (lat == null || lon == null) return;
    let alive = true;
    (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${Number(lat).toFixed(3)}&longitude=${Number(lon).toFixed(3)}`
          + `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,uv_index`
          + `&timezone=${encodeURIComponent(tz)}&forecast_days=3`;
        const res: Response = await sdk().pluginFetch(PLUGIN_ID, { url, cacheTtlMs: 1800000 });
        if (!res.ok) throw new Error(`Weather unavailable (HTTP ${res.status})`);
        const j = await res.json();
        if (alive) { setHourly(j.hourly); setError(undefined); }
      } catch (e) { if (alive) setError((e as Error).message); }
    })();
    return () => { alive = false; };
  }, [lat, lon, tz, tick]);

  const tomorrow = localHour(tz) >= switchHour;
  const day = localDay(tz, tomorrow ? 1 : 0);
  const morning: PeriodWx | null = hourly ? summarize(hourly, day, mFrom, mTo, 'Morning') : null;
  const later: PeriodWx | null = hourly ? summarize(hourly, day, aFrom, aTo, 'Afternoon') : null;
  const whole: PeriodWx | null = hourly ? summarize(hourly, day, mFrom, aTo, 'Day') : null;
  const deg = (c: number) => `${Math.round(imperial ? c * 9 / 5 + 32 : c)}°`;
  const fmtHour = (h: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(2000, 0, 1, h));

  const root: React.CSSProperties = {
    ...hostFrameStyle(style as any),
    width: '100%', height: '100%', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', gap: '0.55em', overflow: 'hidden',
  };

  if (lat == null) return <div style={root}><div style={{ margin: 'auto', opacity: 0.6 }}>Set your location in Settings first.</div></div>;
  if (!hourly || !whole) return (
    <div style={root}><div style={{ margin: 'auto', opacity: 0.6 }}>{error ?? 'Checking the weather…'}</div></div>
  );

  const plan = schoolPlan(morning, later, coldBias);
  // Day off? Weekend, or a "No school / PED day" calendar event on that day.
  const dow = new Date(day + 'T12:00:00Z').getUTCDay();
  const offEvent = ((props.events ?? []) as { title: string; start: string; allDay?: boolean }[]).find((e) => /no school|pedagogical|ped day|congé|journée péd/i.test(e.title)
    && new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }).format(new Date(e.allDay ? e.start.slice(0, 10) + 'T12:00:00' : e.start)) === day);
  const dayOff = dow === 0 || dow === 6 || !!offEvent;
  const s = sky(whole.code);
  const hours: number[] = [];
  for (let h = mFrom + 1; h <= aTo; h += 2) hours.push(h);
  const points = hourPoints(hourly, day, hours);

  const chip = (it: Item, big: boolean) => (
    <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: '0.35em', padding: '0.3em 0.55em', borderRadius: '0.7em', background: big ? `${accent}1c` : 'rgba(127,127,127,0.13)', fontSize: big ? '0.82em' : '0.76em', fontWeight: 500, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: '1.4em', lineHeight: 1 }}>{it.icon}</span><span>{it.label}</span>
    </div>
  );
  const heading = (t: string) => <div style={{ fontSize: '0.62em', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', opacity: 0.6 }}>{t}</div>;

  return (
    <div style={root}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6em' }}>
        <div>
          <div style={{ fontSize: '0.62em', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: accent }}>{tomorrow ? 'Tomorrow' : 'Today'} · {dayOff ? (dow === 0 || dow === 6 ? 'weekend' : 'no school') : 'school day'}</div>
          <div style={{ fontSize: '1.25em', fontWeight: 600, lineHeight: 1.1 }}>{dayOff ? String(config.dayOffTitle || 'Ready to play') : title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em' }}>
          <span style={{ fontSize: '2.1em', lineHeight: 1 }}>{s.icon}</span>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 600, fontSize: '1.15em' }}>{deg(Math.min(morning?.temp ?? whole.temp, later?.temp ?? whole.temp))} → {deg(Math.max(morning?.temp ?? whole.temp, later?.temp ?? whole.temp))}</div>
            <div style={{ fontSize: '0.62em', opacity: 0.7 }}>{s.label}{whole.pop >= 30 ? ` · 💧${whole.pop}%` : ''}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '0.8em', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em', minWidth: 0 }}>
          {heading('👕 Put on')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35em', alignContent: 'flex-start' }}>{plan.wear.map((i) => chip(i, true))}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em', minWidth: 0, paddingLeft: '0.8em', borderLeft: '0.08em dashed rgba(127,127,127,0.45)' }}>
          {heading(dayOff ? '🏠 Day off' : '🎒 In the backpack')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35em', alignContent: 'flex-start' }}>
            {dayOff ? <div style={{ fontSize: '0.8em', opacity: 0.75 }}>No backpack {tomorrow ? 'tomorrow' : 'today'} — dress for playing outside{plan.pack.length ? ':' : ' 🎉'}</div> : null}
            {plan.pack.length ? plan.pack.map((i) => chip(i, false)) : dayOff ? null : <div style={{ fontSize: '0.8em', opacity: 0.6 }}>Nothing extra today 🎉</div>}
          </div>
        </div>
      </div>

      {plan.note && !(dayOff && /backpack/i.test(plan.note)) && <div style={{ fontSize: '0.75em', fontWeight: 500, padding: '0.35em 0.6em', borderRadius: '0.6em', background: 'rgba(127,127,127,0.10)' }}>💡 {plan.note}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${points.length}, 1fr)`, gap: '0.3em', paddingTop: '0.35em', borderTop: '0.06em solid rgba(127,127,127,0.25)' }}>
        {points.map((p) => (
          <div key={p.hour} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7em', lineHeight: 1.2 }}>
            <span style={{ opacity: 0.6 }}>{fmtHour(p.hour)}</span>
            <span style={{ fontSize: '1.5em' }}>{sky(p.code).icon}</span>
            <span style={{ fontWeight: 600 }}>{deg(p.temp)}</span>
            <span style={{ opacity: p.pop >= 30 ? 0.8 : 0 }}>💧{p.pop}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
