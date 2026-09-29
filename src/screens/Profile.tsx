import React, { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { Experience as ExperienceT, experienceHint, experienceLabel, NudgeKind } from '../model';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, Field, SourceLabel, Source, T, Tap, Toast } from '../ds/components';
import { Page } from '../ds/Page';
import { NudgePicker, requestNudgePermission } from './onboarding/Nudges';
import { Glyph } from '../ds/icons';
import { scheduleNudges } from '../nudges';
import { t } from '../i18n';

const hints = experienceHint;

export function Experience({ navigation }: Props<'Experience'>) {
  const { garden, saveProfile } = useStore();
  const { c } = useTheme();
  const [name, setName] = useState(garden.name);
  const [experience, setExperience] = useState<ExperienceT>(garden.caregiver?.experience ?? 'first');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try { await saveProfile({ name: name.trim(), caregiver: { experience, detail: garden.caregiver?.detail ?? (experience === 'many' ? 'Concise' : 'Guided') } }); navigation.goBack(); }
    catch (e) { setError(e instanceof Error ? e.message : t('Could not save.')); }
    finally { setBusy(false); }
  };
  return <Page back={navigation.goBack} title={t("Profile")} footer={<>
    {!!error && <Toast tone="error" title={t("Not saved")} text={error} onClose={() => setError('')} />}
    <Btn title={t("Save")} busy={busy} onPress={() => void save()} />
  </>}>
    <Field label={t("Your name")} value={name} onChangeText={setName} maxLength={40} />
    <View>
      <T v="section" style={{ marginBottom: space[2] }}>{t("Plant experience")}</T>
      <View accessibilityRole="radiogroup" style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
        {(['first', 'some', 'many'] as ExperienceT[]).map(v => {
          const on = v === experience;
          return <Tap key={v} role="radio" selected={on} label={`${experienceLabel[v]}. ${hints[v]}`} onPress={() => setExperience(v)} scaleTo={.99} ring={radius.inner}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
            <View style={{ flex: 1 }}><T v="body" style={{ fontFamily: on ? fonts.medium : fonts.regular }}>{experienceLabel[v]}</T><T v="footnote" tone="ink2">{hints[v]}</T></View>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? c.ink : c.ink3, alignItems: 'center', justifyContent: 'center' }}>{on && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.ink }} />}</View>
          </Tap>;
        })}
      </View>
    </View>
  </Page>;
}

/** What the phone allows, stated plainly, with the one action that changes it. */
function PhonePermission() {
  const { c } = useTheme();
  const { garden } = useStore();
  const [state, setState] = useState<'granted' | 'denied' | 'undetermined' | 'web'>('undetermined');
  const read = async () => {
    if (Platform.OS === 'web') { setState('web'); return; }
    try { const N = await import('expo-notifications'); const p = await N.getPermissionsAsync(); setState(p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied'); } catch { setState('web'); }
  };
  useEffect(() => { void read(); }, []);
  const text = { granted: 'Notifications are on. Nudges arrive at the time below.', denied: 'Notifications are off in your phone’s settings. Nudges show only in the app.', undetermined: 'Notifications aren’t allowed yet. Until then, nudges show only in the app.', web: 'In the browser, nudges show only in the app.' }[state];
  return <View style={{ flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.control, backgroundColor: c.sunken, alignItems: 'flex-start' }}>
    <Glyph name={state === 'granted' ? 'check' : 'info'} size={18} tone={state === 'granted' ? c.leafText : c.ink2} />
    <View style={{ flex: 1, gap: space[2] }}>
      <T v="subhead">{t(text)}</T>
      {state === 'undetermined' && <Btn size="regular" kind="outline" title={t("Allow notifications")} onPress={() => void requestNudgePermission().then(g => { if (g) void scheduleNudges(garden); return read(); })} style={{ alignSelf: 'flex-start' }} />}
      {state === 'denied' && <Btn size="regular" kind="outline" title={t("Open Settings")} onPress={() => void Linking.openSettings()} style={{ alignSelf: 'flex-start' }} />}
    </View>
  </View>;
}

export function Nudges({ navigation }: Props<'Nudges'>) {
  const { garden, saveProfile } = useStore();
  const [kinds, setKinds] = useState<NudgeKind[]>(garden.nudges?.kinds ?? ['soil_check']);
  const [time, setTime] = useState(garden.nudges?.time ?? '08:00');
  const [detail, setDetail] = useState<'Guided' | 'Concise'>(garden.caregiver?.detail ?? 'Guided');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try {
      await saveProfile({ reminders: kinds.length > 0, nudges: { kinds, time }, caregiver: { experience: garden.caregiver?.experience ?? 'first', detail } });
      navigation.goBack();
    } catch (e) { setError(e instanceof Error ? e.message : t('Could not save.')); }
    finally { setBusy(false); }
  };
  return <Page back={navigation.goBack} title={t("Nudges")} gap={space[5]} footer={<>
    {!!error && <Toast tone="error" title={t("Not saved")} text={error} onClose={() => setError('')} />}
    <Btn title={t("Save")} busy={busy} onPress={() => void save()} />
  </>}>
    <PhonePermission />
    <NudgePicker selected={kinds} onToggle={k => setKinds(n => n.includes(k) ? n.filter(x => x !== k) : [...n, k])} detail={detail} onDetail={setDetail} time={time} onTime={setTime} />
  </Page>;
}

const layers: { kind: Source; title: string; text: string }[] = [
  { kind: 'observed', title: 'What you observe', text: 'Soil checks, waterings and leaf notes, kept as you described them. Never turned into percentages.' },
  { kind: 'told', title: 'What you tell us', text: 'Its spot, light, pot and soil. Optional.' },
  { kind: 'species', title: 'General species notes', text: 'What the species usually likes. A start, not a rule for your plant.' },
  { kind: 'suggested', title: 'What Rootera suggests', text: 'Rules that combine the three sources. After three cycles, Rootera shows how long your plant takes to dry. It’s not a watering schedule.' },
  { kind: 'off', title: 'Not connected yet', text: 'Soil sensors, local weather and photo ID. Each will be its own source.' },
];

export function About({ navigation }: Props<'About'>) {
  return <Page back={navigation.goBack} titleInBar={t("How Rootera learns")}>
    <View style={{ gap: space[2] }}>
      <T v="hero">{t("How Rootera learns")}</T>
      <T v="callout" tone="ink2">{t("Each plant has a Plant Twin: its spot and your care, kept apart so every suggestion shows its source.")}</T>
    </View>
    {layers.map(l => <View key={l.title} style={{ gap: space[2] }}>
      <SourceLabel kind={l.kind} />
      <T v="title2">{t(l.title)}</T>
      <T v="body" tone="ink2">{t(l.text)}</T>
    </View>)}
  </Page>;
}
