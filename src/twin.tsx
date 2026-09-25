import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { request } from './api';
import { Badge, Card, Notice, Txt, s } from './ui';
interface Reading { id: string; raw_adc: number; normalized_percent: number; observed_at: string; demo: boolean; }
export function SensorHistory({ plantId }: { plantId: string }) {
 const [rows, setRows] = useState<Reading[]>([]); const [status, setStatus] = useState('Loading readings…');
 useEffect(() => { let active = true; request<Reading[]>(`/v1/plants/${encodeURIComponent(plantId)}/sensor-observations`).then(r => { if (active) { setRows(r.slice().reverse()); setStatus('No device readings yet. Your care records are in Your history.'); } }).catch(() => { if (active) setStatus('Could not load device readings. Please reconnect.'); }); return () => { active = false; }; }, [plantId]);
 return <View style={{ gap: 12 }}>{!rows.length && <Notice title="Sensor measurements" text={status}/>}{rows.map(r => <Card key={r.id}><Badge text={r.demo ? 'Simulated sensor' : 'Sensor measurement'}/><Txt style={s.bold}>{r.normalized_percent}% soil moisture</Txt><Txt small>Original ADC: {r.raw_adc}</Txt><Txt small>{new Date(r.observed_at).toLocaleString()}</Txt></Card>)}</View>;
}
