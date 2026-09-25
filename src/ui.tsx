import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleProp, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlantKind } from './model';
import { color, font, radius, space, type } from './theme';

// The design draws its own focus underline; the browser's default ring would double it.
export const webNoOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as any;

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const plantArt: Record<PlantKind, number> = {
  other: require('../assets/plants/other.png'),
  aloe: require('../assets/plants/aloe.png'),
  'peace-lily': require('../assets/plants/peace-lily.png'),
  monstera: require('../assets/plants/monstera.png'),
  pothos: require('../assets/plants/pothos.png'),
  'snake-plant': require('../assets/plants/snake-plant.png'),
  zz: require('../assets/plants/zz.png'),
  pilea: require('../assets/plants/pilea.png'),
  cactus: require('../assets/plants/cactus.png'),
};

// Web preview only: `?reduceMotion=1` forces the reduced-motion path for testing.
const forceReduce = Platform.OS === 'web' && typeof location !== 'undefined' && /[?&]reduceMotion=1/.test(location.search);

export function useReducedMotion() {
  const [reduce, setReduce] = useState(forceReduce);
  useEffect(() => {
    if (forceReduce) return;
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

type Variant = keyof typeof type;
export function Txt({ v = 'body', children, style, center, tone, lines, ...rest }: React.PropsWithChildren<{ v?: Variant; style?: StyleProp<TextStyle>; center?: boolean; tone?: string; lines?: number } & Omit<React.ComponentProps<typeof Text>, 'style'>>) {
  const header = v === 'hero' || v === 'title';
  return <Text accessibilityRole={header ? 'header' : undefined} numberOfLines={lines} maxFontSizeMultiplier={1.6} style={[type[v], center && { textAlign: 'center' }, tone ? { color: tone } : null, style]} {...rest}>{children}</Text>;
}

export function Icon({ name, size = 20, tone = color.ink }: { name: IconName; size?: number; tone?: string }) {
  return <Ionicons name={name} size={size} color={tone} />;
}

export function Logo({ width = 132 }: { width?: number }) {
  return <Image source={require('../assets/logo.png')} accessibilityLabel="Rootera" resizeMode="contain" style={{ width, height: width / 3.35 }} />;
}

/** Plant illustration or the owner's photo. Unknown species get a sprout in a pot. */
export function PlantArt({ kind, photo, size, style }: { kind: PlantKind; photo?: string | null; size: number; style?: StyleProp<ViewStyle> }) {
  if (photo) return <Image source={{ uri: photo }} accessibilityIgnoresInvertColors style={[{ width: size * .82, height: size, borderRadius: radius.lg }, style as any]} resizeMode="cover" />;
  return <Image source={plantArt[kind]} resizeMode="contain" style={[{ width: size, height: size }, style as any]} />;
}

/** Soft elliptical contact shadow that grounds a plant on the page. */
export function GroundShadow({ width, style }: { width: number; style?: StyleProp<ViewStyle> }) {
  // Circles squashed vertically give a true ellipse; three layers fake a soft falloff.
  const h = width * .16;
  return <View pointerEvents="none" style={[{ alignSelf: 'center', width, height: h, alignItems: 'center', justifyContent: 'center' }, style]}>
    {[[1, .06], [.78, .07], [.52, .09]].map(([k, o]) => <View key={k} style={{ position: 'absolute', width: width * k, height: width * k, borderRadius: width, backgroundColor: `rgba(62,74,42,${o})`, transform: [{ scaleY: .16 / k * (k * .9 + .1) }] }} />)}
  </View>;
}

/** Pressable with a quick scale-down, so every tap answers immediately. */
export function Press({ children, onPress, disabled, style, label, role = 'button', selected, hint }: React.PropsWithChildren<{ onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; label?: string; role?: 'button' | 'radio' | 'tab' | 'link' | 'switch'; selected?: boolean; hint?: string }>) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Layout props must live on the outer pressable, or the child can't stretch or flex.
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const outer: ViewStyle = { flex: flat.flex, alignSelf: flat.alignSelf, width: flat.width, flexGrow: flat.flexGrow, flexShrink: flat.flexShrink };
  return <Pressable style={outer}
    onPress={onPress} disabled={disabled} accessibilityRole={role} accessibilityLabel={label} accessibilityHint={hint}
    accessibilityState={{ disabled: !!disabled, selected: role === 'tab' ? selected : undefined, checked: role === 'radio' ? !!selected : undefined }}
    onPressIn={() => { if (!reduce) scale.value = withTiming(.975, { duration: 90 }); }}
    onPressOut={() => { scale.value = withTiming(1, { duration: 140 }); }}
  >
    <Animated.View style={[style, animated, disabled && { opacity: .45 }]}>{children}</Animated.View>
  </Pressable>;
}

export function Button({ title, onPress, variant = 'primary', icon, busy, disabled, compact, style }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'water'; icon?: IconName; busy?: boolean; disabled?: boolean; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = { primary: color.olive, secondary: 'transparent', quiet: 'transparent', danger: 'transparent', water: color.water }[variant];
  const fg = { primary: color.white, secondary: color.olive, quiet: color.olive, danger: color.danger, water: color.white }[variant];
  return <Press label={title} onPress={busy ? undefined : onPress} disabled={disabled} style={[
    { minHeight: compact ? 44 : 54, borderRadius: radius.md, paddingHorizontal: compact ? 14 : 20, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: bg },
    variant === 'secondary' && { borderWidth: 1.5, borderColor: color.olive },
    variant === 'quiet' && { minHeight: 44, paddingHorizontal: 8 },
    style,
  ]}>
    {busy ? <ActivityIndicator color={fg} /> : <>
      {icon && <Icon name={icon} size={compact ? 17 : 19} tone={fg} />}
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.bodyBold, fontSize: compact ? 15 : 16, color: fg }}>{title}</Text>
    </>}
  </Press>;
}

export function IconButton({ name, onPress, label, tone = color.ink }: { name: IconName; onPress: () => void; label: string; tone?: string }) {
  return <Press label={label} onPress={onPress} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={23} tone={tone} /></Press>;
}

interface ScreenProps {
  back?: () => void; title?: string; right?: React.ReactNode; left?: React.ReactNode;
  footer?: React.ReactNode; scroll?: boolean; tab?: boolean; contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.RefObject<ScrollView | null>; background?: string;
}
export function Screen({ back, title, right, left, footer, scroll = true, tab, contentStyle, scrollRef, background = color.paper, children }: React.PropsWithChildren<ScreenProps>) {
  const header = back || title || right || left;
  const body = <View style={[{ paddingHorizontal: space.gutter, paddingBottom: space.xxl, gap: space.xl }, contentStyle]}>{children}</View>;
  return <SafeAreaView edges={tab ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: background }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      {header && <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <View style={{ minWidth: 44 }}>{back ? <IconButton name="chevron-back" label="Go back" onPress={back} /> : left}</View>
        <Txt v="smallStrong" center lines={1} style={{ flex: 1 }}>{title ?? ''}</Txt>
        <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
      </View>}
      {scroll
        ? <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingTop: header ? 4 : space.lg }}>{body}</ScrollView>
        : <View style={{ flex: 1, paddingTop: header ? 4 : space.lg }}>{body}</View>}
      {footer && <View style={{ paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.md, gap: space.sm, backgroundColor: background, borderTopWidth: StyleSheet.hairlineWidth, borderColor: color.line }}>{footer}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** Where a piece of information came from. Kept visible wherever data is shown. */
export type Provenance = 'user' | 'context' | 'reference' | 'inferred' | 'off';
const provenance: Record<Provenance, { label: string; icon: IconName; tone: string }> = {
  user: { label: 'You observed', icon: 'hand-left-outline', tone: color.leafInk },
  context: { label: 'You told us', icon: 'create-outline', tone: color.inkSoft },
  reference: { label: 'Species note', icon: 'book-outline', tone: color.inkSoft },
  inferred: { label: 'Rootera suggests', icon: 'git-branch-outline', tone: color.olive },
  off: { label: 'Not connected', icon: 'remove-circle-outline', tone: color.inkMuted },
};
export function Tag({ kind, text }: { kind: Provenance; text?: string }) {
  const p = provenance[kind];
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessible accessibilityLabel={`Source: ${text ?? p.label}`}>
    <Icon name={p.icon} size={12} tone={p.tone} />
    <Txt v="label" tone={p.tone}>{text ?? p.label}</Txt>
  </View>;
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.lineStrong, marginLeft: inset }} />;
}

export function Section({ label, action, children, style }: React.PropsWithChildren<{ label: string; action?: { title: string; onPress: () => void }; style?: StyleProp<ViewStyle> }>) {
  return <View style={[{ gap: space.sm }, style]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
      <Txt v="label">{label}</Txt>
      {action && <Press label={action.title} onPress={action.onPress} style={{ minHeight: 44, justifyContent: 'center' }}><Txt v="smallStrong" tone={color.leafInk}>{action.title}</Txt></Press>}
    </View>
    {children}
  </View>;
}

export function Row({ icon, title, detail, value, onPress, trailing, last }: { icon?: IconName; title: string; detail?: string; value?: string; onPress?: () => void; trailing?: React.ReactNode; last?: boolean }) {
  const content = <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: 10, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderColor: color.lineStrong }}>
    {icon && <Icon name={icon} size={20} tone={color.inkSoft} />}
    <View style={{ flex: 1, gap: 2 }}>
      <Txt v="body">{title}</Txt>
      {!!detail && <Txt v="small">{detail}</Txt>}
    </View>
    {!!value && <Txt v="small" style={{ maxWidth: '50%', textAlign: 'right' }}>{value}</Txt>}
    {trailing}
    {onPress && <Icon name="chevron-forward" size={16} tone={color.inkMuted} />}
  </View>;
  return onPress ? <Press label={value ? `${title}, ${value}` : title} onPress={onPress}>{content}</Press> : content;
}

export interface Option<T extends string> { value: T; label: string; hint?: string; leading?: React.ReactNode }
/** A vertical single-choice list. Selection is shown by a filled mark and weight, not by colour alone. */
export function Choice<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T | ''; onChange: (v: T) => void }) {
  return <View accessibilityRole="radiogroup" style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: color.lineStrong }}>
    {options.map(o => {
      const on = o.value === value;
      return <Press key={o.value} role="radio" selected={on} label={o.hint ? `${o.label}. ${o.hint}` : o.label} onPress={() => onChange(o.value)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.lineStrong }}>
        {o.leading}
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v={on ? 'bodyStrong' : 'body'}>{o.label}</Txt>
          {!!o.hint && <Txt v="small">{o.hint}</Txt>}
        </View>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? color.olive : color.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
          {on && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color.olive }} />}
        </View>
      </Press>;
    })}
  </View>;
}

export function Chips<T extends string>({ values, value, onChange, labels }: { values: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
    {values.map(v => {
      const on = v === value;
      return <Press key={v} role="radio" selected={on} label={labels?.[v] ?? v} onPress={() => onChange(v)}
        style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: on ? color.olive : color.lineStrong, backgroundColor: on ? color.olive : 'transparent' }}>
        <Txt v="small" tone={on ? color.white : color.ink}>{labels?.[v] ?? v}</Txt>
      </Press>;
    })}
  </View>;
}

export function Field({ label, value, onChangeText, placeholder, numeric, autoFocus, onSubmitEditing, maxLength = 100 }: { label: string; value: string; onChangeText: (s: string) => void; placeholder?: string; numeric?: boolean; autoFocus?: boolean; onSubmitEditing?: () => void; maxLength?: number }) {
  const [focus, setFocus] = useState(false);
  return <View style={{ gap: 6 }}>
    <Txt v="label">{label}</Txt>
    <TextInput
      accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={color.inkMuted}
      keyboardType={numeric ? 'number-pad' : 'default'} autoFocus={autoFocus} onSubmitEditing={onSubmitEditing} maxLength={maxLength}
      returnKeyType="done" onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} maxFontSizeMultiplier={1.4}
      style={[{ minHeight: 52, borderBottomWidth: focus ? 2 : 1, borderColor: focus ? color.olive : color.lineStrong, fontFamily: font.body, fontSize: 18, color: color.ink, paddingVertical: 10 }, webNoOutline]}
    />
  </View>;
}

/** Inline message. Errors keep the form as it was so the person can retry. */
export function Banner({ tone = 'info', title, text, action, onClose }: { tone?: 'success' | 'error' | 'info'; title: string; text?: string; action?: { title: string; onPress: () => void }; onClose?: () => void }) {
  const t = { success: { bg: color.oliveSoft, fg: color.leafInk, icon: 'checkmark-circle' as IconName }, error: { bg: color.claySoft, fg: color.danger, icon: 'alert-circle' as IconName }, info: { bg: color.paperDeep, fg: color.inkSoft, icon: 'information-circle' as IconName } }[tone];
  return <View accessibilityLiveRegion="polite" accessibilityRole={tone === 'error' ? 'alert' : undefined} style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: t.bg, alignItems: 'flex-start' }}>
    <Icon name={t.icon} size={20} tone={t.fg} />
    <View style={{ flex: 1, gap: 2 }}>
      <Txt v="smallStrong">{title}</Txt>
      {!!text && <Txt v="small">{text}</Txt>}
      {action && <Press label={action.title} onPress={action.onPress} style={{ paddingTop: 6, minHeight: 32 }}><Txt v="smallStrong" tone={color.olive}>{action.title}</Txt></Press>}
    </View>
    {onClose && <Press label="Dismiss" onPress={onClose} style={{ marginTop: -10, marginRight: -10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={18} tone={color.inkSoft} /></Press>}
  </View>;
}

export function Segmented<T extends string>({ values, value, onChange, labels }: { values: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: color.paperDeep, borderRadius: radius.md, padding: 3 }}>
    {values.map(v => <Press key={v} role="tab" selected={v === value} label={labels?.[v] ?? v} onPress={() => onChange(v)} style={{ flex: 1 }}>
      <View style={{ minHeight: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: v === value ? color.surface : 'transparent' }}>
        <Txt v={v === value ? 'smallStrong' : 'small'}>{labels?.[v] ?? v}</Txt>
      </View>
    </Press>)}
  </View>;
}
