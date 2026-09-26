import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useCompact, useTheme } from './theme';
import { elevation, fonts, glass, radius, space, springs, type, TypeName } from './tokens';
import { announce, haptic } from './feedback';
import { Glyph, GlyphName } from './icons';

type Tone = 'ink' | 'ink2' | 'ink3' | 'leafText' | 'clayText' | 'danger' | 'onAction' | 'water';
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;

export function T({ v = 'body', tone = 'ink', center, lines, style, children, ...rest }: React.PropsWithChildren<{ v?: TypeName; tone?: Tone; center?: boolean; lines?: number; style?: StyleProp<TextStyle> } & Omit<React.ComponentProps<typeof Text>, 'style'>>) {
  const { c } = useTheme();
  const heading = v === 'display' || v === 'hero' || v === 'largeTitle' || v === 'title' || v === 'section';
  return <Text accessibilityRole={heading ? 'header' : undefined} numberOfLines={lines} maxFontSizeMultiplier={1.7}
    style={[type[v], { color: c[tone] }, center && { textAlign: 'center' }, style]} {...rest}>{children}</Text>;
}

/**
 * Glass material for chrome that floats over content. Text on it stays AA because
 * the tint is dense enough over any backdrop; with Reduce Transparency it turns solid.
 */
export function Glass({ level = 'chrome', r = radius.card, style, children, shadow = true }: React.PropsWithChildren<{ level?: keyof typeof glass; r?: number; style?: StyleProp<ViewStyle>; shadow?: boolean }>) {
  const { c, scheme, reduceTransparency } = useTheme();
  const g = glass[level];
  return <View style={[{ borderRadius: r, borderCurve: 'continuous' }, shadow && { ...elevation.float, shadowColor: c.shadow }, style]}>
    <View style={[StyleSheet.absoluteFill, { borderRadius: r, borderCurve: 'continuous', overflow: 'hidden' }]}>
      {reduceTransparency
        ? <View style={[StyleSheet.absoluteFill, { backgroundColor: c.raised }]} />
        : <>
            <BlurView intensity={g.blur * 2.4} tint={scheme === 'dark' ? 'dark' : 'light'} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: c[g.tint] }]} />
          </>}
      {/* Specular edge: a light rim along the top, as if lit from above. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, borderWidth: StyleSheet.hairlineWidth, borderColor: c.glassRim }]} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: r * .6, right: r * .6, height: 1, backgroundColor: c.glassEdge }} />
    </View>
    {children}
  </View>;
}

// Focus rings are for keyboard users (like :focus-visible): a pointer press hides them.
let keyboardModality = false;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key.startsWith('Arrow')) keyboardModality = true; }, true);
  window.addEventListener('pointerdown', () => { keyboardModality = false; }, true);
}

/** Every touchable: spring press, visible keyboard focus ring, 44-pt minimum target. */
/** `onLongPress` is mirrored as a named accessibility action, so it is never touch-only. */
export function Tap({ onPress, onLongPress, longPressLabel, label, hint, role = 'button', selected, disabled, style, children, ring = radius.control, scaleTo = .97 }: React.PropsWithChildren<{ onPress?: () => void; onLongPress?: () => void; longPressLabel?: string; label: string; hint?: string; role?: 'button' | 'link' | 'tab' | 'radio' | 'switch'; selected?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; ring?: number; scaleTo?: number }>) {
  const { c, reduceMotion } = useTheme();
  const [focus, setFocus] = useState(false);
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  return <Pressable onPress={onPress} onLongPress={onLongPress ? () => { haptic.tap(); onLongPress(); } : undefined} disabled={disabled} accessibilityRole={role} accessibilityLabel={label} accessibilityHint={hint}
    accessibilityActions={onLongPress ? [{ name: 'longpress', label: longPressLabel ?? 'More options' }] : undefined}
    onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'longpress') onLongPress?.(); }}
    accessibilityState={{ disabled: !!disabled, selected: role === 'tab' ? selected : undefined, checked: role === 'radio' || role === 'switch' ? !!selected : undefined }}
    onPressIn={() => { if (!reduceMotion) s.value = withSpring(scaleTo, springs.snappy); }}
    onPressOut={() => { s.value = withSpring(1, springs.snappy); }}
    onFocus={() => setFocus(Platform.OS !== 'web' || keyboardModality)} onBlur={() => setFocus(false)}
    style={[{ flex: flat.flex, alignSelf: flat.alignSelf, width: flat.width, flexGrow: flat.flexGrow }, noOutline]}>
    <Animated.View style={[style, anim, disabled && { opacity: .4 }]}>
      {children}
      {focus && <View pointerEvents="none" style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: ring + 3, borderWidth: 2, borderColor: c.leafMark }} />}
    </Animated.View>
  </Pressable>;
}

/**
 * Buttons. `filled` is the one primary action per screen; `outline` a real alternative;
 * `plain` a text action. Near-square corners and medium weight: tools, not candy.
 */
type ButtonKind = 'filled' | 'outline' | 'plain' | 'glass' | 'destructive';
/**
 * `hint` explains what is missing while the button is disabled: it is shown above the
 * button and read by screen readers, so a greyed-out action never leaves people guessing.
 */
export function Btn({ title, onPress, kind = 'filled', icon, busy, disabled, size = 'large', style, hint, label }: { title: string; onPress: () => void; kind?: ButtonKind; icon?: GlyphName; busy?: boolean; disabled?: boolean; size?: 'large' | 'regular'; style?: StyleProp<ViewStyle>; hint?: string; label?: string }) {
  const { c } = useTheme();
  const fg = { filled: c.onAction, outline: c.ink, plain: c.leafText, glass: c.ink, destructive: c.danger }[kind];
  const h = size === 'large' ? 52 : 44;
  const r = radius.control;
  const body = <View style={{ minHeight: h, paddingHorizontal: kind === 'plain' ? space[1] : size === 'large' ? space[5] : space[4], flexDirection: 'row', alignItems: 'center', justifyContent: kind === 'plain' ? 'flex-start' : 'center', gap: space[2] }}>
    {busy ? <ActivityIndicator color={fg} /> : <>
      {icon && <Glyph name={icon} size={18} tone={fg} />}
      <T v={size === 'large' ? 'headline' : 'callout'} style={{ color: fg, fontFamily: fonts.medium }}>{title}</T>
    </>}
  </View>;
  const button = <Tap label={label ?? title} hint={disabled ? hint : undefined} onPress={busy ? undefined : onPress} disabled={disabled} style={hint ? undefined : style} ring={r}>
    {kind === 'glass'
      ? <Glass level="control" r={r}>{body}</Glass>
      : <View style={[{ borderRadius: r, borderCurve: 'continuous' },
          kind === 'filled' && { backgroundColor: c.action },
          (kind === 'outline' || kind === 'destructive') && { borderWidth: 1, borderColor: kind === 'destructive' ? c.danger : c.ink3 }]}>{body}</View>}
  </Tap>;
  if (!hint) return button;
  return <View style={[{ gap: space[2] }, style]}>
    {disabled && <T v="footnote" tone="ink2" center importantForAccessibility="no" accessibilityElementsHidden>{hint}</T>}
    {button}
  </View>;
}

/** Round glass control for toolbars that float over content. */
export function GlassIcon({ name, label, onPress, size = 44 }: { name: GlyphName; label: string; onPress: () => void; size?: number }) {
  return <Tap label={label} onPress={onPress} ring={size / 2} scaleTo={.9}>
    <Glass level="control" r={size / 2} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Glyph name={name} size={20} />
    </Glass>
  </Tap>;
}

/** Option tag: hairline rectangle, filled with ink when chosen. */
export function Chip({ label, selected, onPress, count }: { label: string; selected?: boolean; onPress: () => void; count?: number }) {
  const { c } = useTheme();
  return <Tap role="radio" selected={selected} label={count === undefined ? label : `${label}, ${count} ${count === 1 ? 'plant' : 'plants'}`} onPress={() => { haptic.select(); onPress(); }} ring={radius.input}
    style={{ minHeight: 40, paddingHorizontal: 13, borderRadius: radius.input, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: selected ? c.ink : c.hairline, backgroundColor: selected ? c.ink : 'transparent' }}>
    <T v="subhead" style={{ color: selected ? c.canvas : c.ink }}>{label}</T>
    {count !== undefined && <T v="footnote" style={{ color: selected ? c.canvas : c.ink2, opacity: selected ? .75 : 1, fontVariant: ['tabular-nums'] }}>{count}</T>}
  </Tap>;
}

/**
 * A section of rows: serif italic heading, hairlines edge to edge, no card and no
 * decorative icons. Reads like a catalogue index, not a settings template.
 */
export function Group({ header, footer, children }: React.PropsWithChildren<{ header?: string; footer?: string }>) {
  const { c } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return <View>
    {header && <T v="section" style={{ marginBottom: space[2] }}>{header}</T>}
    <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
      {rows.map((row, i) => <View key={i} style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>{row}</View>)}
    </View>
    {footer && <T v="footnote" tone="ink3" style={{ marginTop: space[2] }}>{footer}</T>}
  </View>;
}

export function Row({ title, detail, value, onPress, trailing }: { title: string; detail?: string; value?: string; onPress?: () => void; trailing?: React.ReactNode }) {
  const { c } = useTheme();
  const body = <View style={{ minHeight: 54, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
    <View style={{ flex: 1, gap: 2 }}>
      <T v="body">{title}</T>
      {!!detail && <T v="footnote" tone="ink2">{detail}</T>}
    </View>
    {!!value && <T v="subhead" tone="ink2">{value}</T>}
    {trailing}
    {onPress && <Glyph name="forward" size={15} tone={c.ink3} />}
  </View>;
  return onPress ? <Tap label={value ? `${title}, ${value}` : title} onPress={onPress} scaleTo={.99} ring={radius.inner}>{body}</Tap> : body;
}

/** Editorial field: small label, text on a baseline rule that thickens on focus. */
export function Field({ label, value, onChangeText, placeholder, numeric, autoFocus, onSubmitEditing, maxLength = 100, help }: { label: string; value: string; onChangeText: (s: string) => void; placeholder?: string; numeric?: boolean; autoFocus?: boolean; onSubmitEditing?: () => void; maxLength?: number; help?: string }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return <View style={{ gap: 2 }}>
    <T v="footnote" tone={focus ? 'ink' : 'ink2'}>{label}</T>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.ink3}
      keyboardType={numeric ? 'number-pad' : 'default'} autoFocus={autoFocus} onSubmitEditing={onSubmitEditing} maxLength={maxLength} returnKeyType="done"
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} maxFontSizeMultiplier={1.5}
      style={[type.title2, { color: c.ink, minHeight: 50, paddingVertical: 8, borderBottomWidth: focus ? 2 : 1, borderColor: focus ? c.ink : c.ink3 }, noOutline]} />
    {!!help && <T v="footnote" tone="ink3" style={{ marginTop: 6 }}>{help}</T>}
  </View>;
}

/**
 * Where a fact comes from, as a catalogue legend: one small geometric mark per source
 * (● observed, ○ told, ■ species, ◆ suggested, a short rule for not connected) and quiet text.
 */
export type Source = 'observed' | 'told' | 'species' | 'suggested' | 'off';
const sourceText: Record<Source, string> = { observed: 'You observed', told: 'You told us', species: 'Species note', suggested: 'Rootera suggests', off: 'Not connected' };
export function SourceMark({ kind, size = 8 }: { kind: Source; size?: number }) {
  const { c } = useTheme();
  const tone = kind === 'observed' ? c.leafMark : kind === 'off' ? c.ink3 : c.ink2;
  const base: ViewStyle = { width: size, height: size };
  if (kind === 'observed') return <View style={[base, { borderRadius: size, backgroundColor: tone }]} />;
  if (kind === 'told') return <View style={[base, { borderRadius: size, borderWidth: 1.5, borderColor: tone }]} />;
  if (kind === 'species') return <View style={[base, { backgroundColor: tone }]} />;
  if (kind === 'suggested') return <View style={[base, { backgroundColor: tone, transform: [{ rotate: '45deg' }, { scale: .85 }] }]} />;
  return <View style={{ width: size + 2, height: 1.5, backgroundColor: tone }} />;
}
export function SourceLabel({ kind, text }: { kind: Source; text?: string }) {
  return <View accessible accessibilityLabel={`Source: ${text ?? sourceText[kind]}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
    <View style={{ width: 10, alignItems: 'center' }}><SourceMark kind={kind} /></View>
    <T v="footnote" tone={kind === 'off' ? 'ink3' : 'ink2'}>{text ?? sourceText[kind]}</T>
  </View>;
}

/** A real number with its unit; tabular so values don't jump. */
export function Figure({ value, unit, caption }: { value: string; unit?: string; caption: string }) {
  return <View style={{ gap: 2 }}>
    <T v="figure" lines={1}>{value}{!!unit && <T v="subhead" tone="ink2"> {unit}</T>}</T>
    <T v="footnote" tone="ink2">{caption}</T>
  </View>;
}

/** Two or three peer options as underlined tabs, not a pill toggle. */
export function Segmented<V extends string>({ values, value, onChange, labels }: { values: readonly V[]; value: V; onChange: (v: V) => void; labels?: Partial<Record<V, string>> }) {
  const { c } = useTheme();
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
    {values.map(v => {
      const on = v === value;
      return <Tap key={v} role="tab" selected={on} label={labels?.[v] ?? v} onPress={() => onChange(v)} style={{ flex: 1 }} ring={radius.inner} scaleTo={.99}>
        <View style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderColor: on ? c.ink : 'transparent', marginBottom: -StyleSheet.hairlineWidth }}>
          <T v="subhead" style={{ color: on ? c.ink : c.ink2, fontFamily: on ? fonts.medium : fonts.regular }}>{labels?.[v] ?? v}</T>
        </View>
      </Tap>;
    })}
  </View>;
}

/** Floating confirmation on glass. The caller decides when it appears and leaves. */
export function Toast({ title, text, tone = 'success', onClose, action }: { title: string; text?: string; tone?: 'success' | 'error' | 'info'; onClose?: () => void; action?: { title: string; onPress: () => void } }) {
  const { c } = useTheme();
  const icon: GlyphName = tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'info';
  const accent = tone === 'success' ? c.leafMark : tone === 'error' ? c.danger : c.ink2;
  // Status messages are spoken on iOS too (liveRegion only covers Android), with a matching haptic.
  useEffect(() => {
    announce([title, text].filter(Boolean).join('. '));
    if (tone === 'error') haptic.error(); else if (tone === 'success') haptic.success();
  }, [title, text]);
  const shake = useSharedValue(0);
  const { reduceMotion } = useTheme();
  useEffect(() => {
    if (tone !== 'error' || reduceMotion) return;
    shake.value = withSequence(withTiming(-6, { duration: 50 }), withTiming(6, { duration: 60 }), withTiming(-4, { duration: 60 }), withTiming(3, { duration: 60 }), withTiming(0, { duration: 70 }));
  }, [title, text]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  return <Animated.View style={shakeStyle}><Glass level="control" r={radius.card} style={{ padding: space[4], flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
    <View accessibilityLiveRegion="polite" accessibilityRole={tone === 'error' ? 'alert' : undefined} style={{ flex: 1, flexDirection: 'row', gap: space[3] }}>
      <View style={{ marginTop: 1 }}><Glyph name={icon} size={20} tone={accent} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="headline">{title}</T>
        {!!text && <T v="subhead" tone="ink2">{text}</T>}
        {action && <Tap label={action.title} onPress={action.onPress} style={{ alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' }}><T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>{action.title}</T></Tap>}
      </View>
    </View>
    {onClose && <Tap label="Dismiss" onPress={onClose} ring={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -12, marginRight: -12 }}><Glyph name="close" size={16} tone={c.ink2} /></Tap>}
  </Glass></Animated.View>;
}

export interface TabItem { key: string; label: string; icon: GlyphName }
/** Floating glass tab bar: lifted off the bottom edge; the selected tab gets a quiet solid plate. */
export function FloatingTabBar({ items, active, onSelect, bottomInset }: { items: TabItem[]; active: string; onSelect: (key: string) => void; bottomInset: number }) {
  const { c } = useTheme();
  // With large text or a narrow screen the bar keeps its size: icons only, names stay spoken.
  const compact = useCompact();
  const { reduceMotion } = useTheme();
  // One plate moves between tabs (spatial continuity) instead of four backgrounds switching.
  const [slots, setSlots] = useState<Record<string, { x: number; w: number }>>({});
  const plateX = useSharedValue(0), plateW = useSharedValue(0);
  const target = slots[active];
  useEffect(() => {
    if (!target) return;
    if (reduceMotion || !plateW.value) { plateX.value = target.x; plateW.value = target.w; return; }
    plateX.value = withSpring(target.x, springs.snappy); plateW.value = withSpring(target.w, springs.snappy);
  }, [target?.x, target?.w, reduceMotion]);
  const plate = useAnimatedStyle(() => ({ opacity: plateW.value ? 1 : 0, width: plateW.value, transform: [{ translateX: plateX.value }] }));
  return <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(bottomInset, space[3]), alignItems: 'center' }}>
    <Glass level="chrome" r={radius.chrome} style={{ flexDirection: 'row', padding: 5, gap: 2 }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 5, left: 0, height: 52, borderRadius: radius.chrome - 5, backgroundColor: c.sunken }, plate]} />
      {items.map(t => {
        const on = t.key === active;
        return <Tap key={t.key} role="tab" selected={on} label={t.label} onPress={() => { if (!on) haptic.select(); onSelect(t.key); }} ring={radius.chrome - 5} scaleTo={.93}>
          <View onLayout={e => { const { x, width } = e.nativeEvent.layout; setSlots(s => s[t.key]?.x === x && s[t.key]?.w === width ? s : { ...s, [t.key]: { x, w: width } }); }}
            style={{ minWidth: compact ? 56 : 72, height: 52, borderRadius: radius.chrome - 5, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Glyph name={t.icon} size={22} filled={on} tone={on ? c.ink : c.ink2} />
            {!compact && <T v="caption" maxFontSizeMultiplier={1.2} style={{ color: on ? c.ink : c.ink2 }}>{t.label}</T>}
          </View>
        </Tap>;
      })}
    </Glass>
  </View>;
}
