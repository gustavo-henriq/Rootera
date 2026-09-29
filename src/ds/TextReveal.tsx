/**
 * Blur-in by word: each word fades up out of a soft blur, one after another.
 * On the web the blur is a real CSS filter; native React Native cannot blur text,
 * so words rise and fade there, which reads the same at reading distance.
 * No springs and no overshoot: text should arrive calmly, not bounce.
 */
import React, { useEffect } from 'react';
import { Platform, StyleProp, TextStyle, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTheme } from './theme';
import { type, TypeName } from './tokens';

const web = Platform.OS === 'web';

function Word({ word, i, delay, perWord, style, colour, run, skip }: { word: string; i: number; delay: number; perWord: number; style: StyleProp<TextStyle>; colour: string; run: number; skip?: boolean }) {
  const { reduceMotion } = useTheme();
  const p = useSharedValue(reduceMotion && run ? 1 : 0);
  useEffect(() => {
    if (!run) { p.value = 0; return; }
    if (reduceMotion || skip) { cancelAnimation(p); p.value = 1; return; }
    p.value = 0;
    p.value = withDelay(delay + i * perWord, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [run, reduceMotion, skip]);
  const anim = useAnimatedStyle(() => {
    const base: any = { opacity: p.value, transform: [{ translateY: (1 - p.value) * 8 }] };
    if (web) base.filter = `blur(${(1 - p.value) * 10}px)`;
    return base;
  });
  return <Animated.Text style={[style, { color: colour }, anim]}>{word}{' '}</Animated.Text>;
}

/** `run` 0 keeps the words hidden (their space is kept); `skip` shows them all at once, as after a tap. */
export function TextReveal({ text, v = 'hero', tone = 'ink', center, delay = 0, perWord = 70, run = 1, skip, style }: { text: string; v?: TypeName; tone?: 'ink' | 'ink2'; center?: boolean; delay?: number; perWord?: number; run?: number; skip?: boolean; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  const heading = v === 'display' || v === 'hero' || v === 'largeTitle' || v === 'title';
  // Screen readers get the sentence once, not word by word.
  return <View accessible accessibilityRole={heading ? 'header' : 'text'} accessibilityLabel={text}
    style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: center ? 'center' : 'flex-start' }}>
    {text.split(' ').map((w, i) => <Word key={`${i}-${w}`} word={w} i={i} delay={delay} perWord={perWord} run={run} skip={skip} style={[type[v], style]} colour={c[tone]} />)}
  </View>;
}

/** How long a reveal takes, so the next element can wait for it. */
export const revealDuration = (text: string, perWord = 70) => text.split(' ').length * perWord + 520;
