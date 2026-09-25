import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CareEvent, LOCALE } from '../model';
import { useTheme } from './theme';
import { space, type } from './tokens';
import { T, Tap } from './components';
import { Glyph } from './icons';
import { Pop } from './motion';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * A month of dots: green where watering was recorded, a centre mark where the soil
 * or leaves were checked. Only recorded care is drawn, never a planned date.
 */
export function CareCalendar({ events }: { events: CareEvent[] }) {
  const { c } = useTheme();
  const today = new Date();
  const [offset, setOffset] = useState(0);
  const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const { watered, checked } = useMemo(() => {
    const w = new Set<string>(), k = new Set<string>();
    events.forEach(e => (e.type === 'Watered' ? w : k).add(key(new Date(e.at))));
    return { watered: w, checked: k };
  }, [events]);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (month.getDay() + 6) % 7;
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const count = cells.filter(d => d && watered.has(key(d))).length;
  const earliest = events.length ? new Date(Math.min(...events.map(e => new Date(e.at).getTime()))) : today;
  const canBack = month > new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const monthName = month.toLocaleDateString(LOCALE, { month: 'long' });

  return <View style={{ gap: space[3] }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}>
        <T style={[type.figure, { fontSize: 44, lineHeight: 48 }]}>{count}</T>
        <T v="footnote" tone="ink2">{count === 1 ? 'watering' : 'waterings'} in {monthName}</T>
      </View>
      <Tap label="Previous month" disabled={!canBack} onPress={() => setOffset(offset - 1)} ring={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Glyph name="back" size={20} /></Tap>
      <Tap label="Next month" disabled={offset >= 0} onPress={() => setOffset(offset + 1)} ring={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Glyph name="forward" size={20} /></Tap>
    </View>
    <View accessible accessibilityLabel={`${month.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })}: ${count} waterings recorded`}>
      <View style={{ flexDirection: 'row' }}>{WEEK.map((d, i) => <T key={i} v="caption" tone="ink2" center style={{ flex: 1 }}>{d}</T>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const k = key(d);
          const isToday = k === key(today);
          const future = d > today && !isToday;
          const water = watered.has(k);
          return <View key={`${offset}-${k}`} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 4 }}>
            <Pop delay={i * 12} style={{ flex: 1 }}>
              <View style={{ flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: water ? c.leaf : future ? 'transparent' : c.sunken, borderWidth: future || isToday ? 1.5 : 0, borderColor: isToday ? c.ink : c.hairline }}>
                {checked.has(k) && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: water ? c.canvas : c.ink2 }} />}
              </View>
            </Pop>
          </View>;
        })}
      </View>
    </View>
    <View style={{ flexDirection: 'row', gap: space[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.leaf }} /><T v="footnote" tone="ink2">Watered</T></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.ink2 }} /></View><T v="footnote" tone="ink2">Checked</T></View>
    </View>
  </View>;
}
