import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CareEvent, LOCALE } from './model';
import { color, font, space } from './theme';
import { IconButton, Txt } from './ui';
import { CountUp, Pop } from './motion';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Month of dots: green where watering was recorded, a centre mark where the soil
 * was checked. Only recorded care is drawn, never a planned or predicted date.
 */
export function CareCalendar({ events }: { events: CareEvent[] }) {
  const today = new Date();
  const [offset, setOffset] = useState(0);
  const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const { watered, checked } = useMemo(() => {
    const w = new Set<string>(), c = new Set<string>();
    events.forEach(e => {
      const k = key(new Date(e.at));
      if (e.type === 'Watered') w.add(k);
      else c.add(k);
    });
    return { watered: w, checked: c };
  }, [events]);

  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (month.getDay() + 6) % 7;
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const count = cells.filter(d => d && watered.has(key(d))).length;
  const earliest = events.length ? new Date(Math.min(...events.map(e => new Date(e.at).getTime()))) : today;
  const canBack = month > new Date(earliest.getFullYear(), earliest.getMonth(), 1);

  return <View style={{ gap: space.md }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}>
        <CountUp value={count} style={{ fontFamily: font.display, fontSize: 44, lineHeight: 48, letterSpacing: -1.5, color: color.ink }} />
        <Txt v="small">{count === 1 ? 'watering' : 'waterings'} in {month.toLocaleDateString(LOCALE, { month: 'long' })}</Txt>
      </View>
      <IconButton name="chevron-back" label="Previous month" tone={canBack ? color.ink : color.lineStrong} onPress={() => canBack && setOffset(offset - 1)} />
      <IconButton name="chevron-forward" label="Next month" tone={offset < 0 ? color.ink : color.lineStrong} onPress={() => offset < 0 && setOffset(offset + 1)} />
    </View>
    <View accessible accessibilityLabel={`${month.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })}: ${count} waterings recorded`}>
      <View style={{ flexDirection: 'row' }}>
        {WEEK.map((d, i) => <Txt key={i} v="label" center style={{ flex: 1 }}>{d}</Txt>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const k = key(d);
          const future = d > today && k !== key(today);
          const isToday = k === key(today);
          const water = watered.has(k);
          return <View key={`${offset}-${k}`} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 4 }}>
            <Pop delay={i * 14} style={{ flex: 1 }}><View style={{
              flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
              backgroundColor: water ? color.leaf : future ? 'transparent' : color.paperDeep,
              borderWidth: future || isToday ? 1.5 : 0, borderColor: isToday ? color.olive : color.line,
            }}>
              {checked.has(k) && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: water ? color.white : color.olive }} />}
            </View></Pop>
          </View>;
        })}
      </View>
    </View>
    <View style={{ flexDirection: 'row', gap: space.lg }}>
      <Legend swatch={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.leaf }} />} text="Watered" />
      <Legend swatch={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.paperDeep, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color.olive }} /></View>} text="Checked" />
    </View>
  </View>;
}

function Legend({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{swatch}<Txt v="small" style={{ fontSize: 12 }}>{text}</Txt></View>;
}
