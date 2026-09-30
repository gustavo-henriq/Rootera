/**
 * What happens after a photo, shared by Add a plant and the first-plant step.
 *
 * The photo is only for identifying: the plant keeps Rootera's illustration (its species',
 * or the plain pot until one is drawn). Low-confidence answers count as a miss, because
 * adding the wrong species is worse than asking. A miss never sends the person back to
 * the start: two more photos are offered, each with a different tip, and after the third
 * the name is asked for, with Pl@ntNet's weak guesses as "Maybe it's…".
 */
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Candidate } from '../api';
import { useTheme } from '../ds/theme';
import { enter } from '../ds/motion';
import { fonts, radius, space } from '../ds/tokens';
import { Chip, T, Tap } from '../ds/components';
import { Glyph } from '../ds/icons';
import { t } from '../i18n';

export const MAX_ATTEMPTS = 3;
/** Pl@ntNet scores (0-1) under this are guesses, not identifications. */
export const CONFIDENT = .2;
/** `limit`: the day's photo identifications are used up; the name is asked for at once. */
export type IdState = 'idle' | 'loading' | 'off' | 'error' | 'limit';
const TIPS = [
  'Try again with one leaf up close, in good light.',
  'Try the whole plant, or a flower, against a plain background.',
];

export function confidentMatches(matches: Candidate[] | null) {
  return (matches ?? []).filter(m => m.score >= CONFIDENT);
}

export function IdentifyResult({ state, matches, attempt, onRetry, onPick, selected }: {
  state: IdState; matches: Candidate[] | null; attempt: number; onRetry: () => void; onPick: (m: Candidate) => void; selected?: string;
}) {
  const { c, reduceMotion } = useTheme();
  const sure = confidentMatches(matches);
  const missed = state === 'error' || (state === 'idle' && matches !== null && sure.length === 0);
  const guesses = (matches ?? []).filter(m => m.score < CONFIDENT);
  if (state === 'loading') return <T v="subhead" tone="ink2">{t('Looking for matches with Pl@ntNet…')}</T>;
  if (state === 'off') return <T v="subhead" tone="ink2">{t('Photo ID is off in this preview. Pick the plant below.')}</T>;
  if (state === 'limit') return <T v="subhead">{t('That’s all the photo identifications for today. Write the name below, even a rough one.')}</T>;
  if (sure.length) return <View style={{ gap: space[2] }}>
    <T v="footnote" tone="ink2">{sure.length === 1 ? t('It looks like:') : t('It looks like one of these:')}</T>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {sure.map(m => <Chip key={m.scientific_name} label={m.common_name || m.scientific_name} selected={selected === m.scientific_name} onPress={() => onPick(m)} />)}
    </View>
  </View>;
  if (!missed) return null;
  // A miss: another photo with a new tip, or, after the last one, the name.
  return <Animated.View entering={reduceMotion ? undefined : enter.fade()} style={{ gap: space[3] }}>
    {attempt < MAX_ATTEMPTS
      ? <>
          <T v="subhead">{t('Rootera couldn’t recognize it this time.')} {t(TIPS[Math.min(attempt, TIPS.length) - 1])}</T>
          <Tap label={t('Take another photo ({n} of {max})', { n: attempt + 1, max: MAX_ATTEMPTS })} onPress={onRetry} ring={radius.input}
            style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: space[4], borderRadius: radius.input, borderWidth: 1, borderColor: c.ink, flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Glyph name="camera" size={18} />
            <T v="subhead" style={{ fontFamily: fonts.medium }}>{t('Take another photo ({n} of {max})', { n: attempt + 1, max: MAX_ATTEMPTS })}</T>
          </Tap>
        </>
      : <>
          <T v="subhead">{t('The photo didn’t work out. Write the name below, even a rough one.')}</T>
          {!!guesses.length && <View style={{ gap: space[2] }}>
            <T v="footnote" tone="ink2">{t('Maybe it’s:')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {guesses.map(m => <Chip key={m.scientific_name} label={m.common_name || m.scientific_name} selected={selected === m.scientific_name} onPress={() => onPick(m)} />)}
            </View>
          </View>}
          <T v="footnote" tone="ink2">{t('Don’t know it? Add it as an unknown plant; Rootera learns from your checks.')}</T>
        </>}
  </Animated.View>;
}
