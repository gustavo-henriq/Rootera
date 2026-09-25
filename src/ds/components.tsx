import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme } from './theme';
import { elevation, glass, radius, space, springs, type, TypeName } from './tokens';
import { Glyph, GlyphName } from './icons';

type Tone = 'ink' | 'ink2' | 'ink3' | 'leafText' | 'clayText' | 'danger' | 'onAction' | 'water';

export function T({ v = 'body', tone = 'ink', center, lines, style, children, ...rest }: React.PropsWithChildren<{ v?: TypeName; tone?: Tone; center?: boolean; lines?: number; style?: StyleProp<TextStyle> } & Omit<React.ComponentProps<typeof Text>, 'style'>>) {
  const { c } = useTheme();
  const heading = v === 'display' || v === 'hero' || v === 'largeTitle' || v === 'title';
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

/** Every touchable: spring press, visible keyboard focus ring, 44-pt minimum target. */
export function Tap({ onPress, label, hint, role = 'button', selected, disabled, style, children, ring = radius.control, scaleTo = .96 }: React.PropsWithChildren<{ onPress?: () => void; label: string; hint?: string; role?: 'button' | 'link' | 'tab' | 'radio' | 'switch'; selected?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; ring?: number; scaleTo?: number }>) {
  const { c, reduceMotion } = useTheme();
  const [focus, setFocus] = useState(false);
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole={role} accessibilityLabel={label} accessibilityHint={hint}
    accessibilityState={{ disabled: !!disabled, selected: role === 'tab' ? selected : undefined, checked: role === 'radio' || role === 'switch' ? !!selected : undefined }}
    onPressIn={() => { if (!reduceMotion) s.value = withSpring(scaleTo, springs.snappy); }}
    onPressOut={() => { s.value = withSpring(1, springs.snappy); }}
    onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
    style={[{ flex: flat.flex, alignSelf: flat.alignSelf, width: flat.width, flexGrow: flat.flexGrow }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}>
    <Animated.View style={[style, anim, disabled && { opacity: .4 }]}>
      {children}
      {focus && <View pointerEvents="none" style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: ring + 3, borderWidth: 2, borderColor: c.leafMark }} />}
    </Animated.View>
  </Pressable>;
}

type ButtonKind = 'filled' | 'tinted' | 'plain' | 'glass' | 'destructive';
export function Btn({ title, onPress, kind = 'filled', icon, busy, disabled, size = 'large', style }: { title: string; onPress: () => void; kind?: ButtonKind; icon?: GlyphName; busy?: boolean; disabled?: boolean; size?: 'large' | 'regular'; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const fg = { filled: c.onAction, tinted: c.leafText, plain: c.leafText, glass: c.ink, destructive: c.danger }[kind];
  const h = size === 'large' ? 54 : 44;
  const body = <View style={{ minHeight: h, paddingHorizontal: kind === 'plain' ? space[2] : size === 'large' ? space[6] : space[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] }}>
    {busy ? <ActivityIndicator color={fg} /> : <>
      {icon && <Glyph name={icon} size={size === 'large' ? 20 : 18} tone={fg} />}
      <T v={size === 'large' ? 'headline' : 'subhead'} style={{ color: fg, fontWeight: '600' }}>{title}</T>
    </>}
  </View>;
  const shell: ViewStyle = { borderRadius: size === 'large' ? radius.control : radius.pill, borderCurve: 'continuous', overflow: kind === 'glass' ? 'visible' : 'hidden' };
  return <Tap label={title} onPress={busy ? undefined : onPress} disabled={disabled} style={[shell, style]} ring={shell.borderRadius as number}>
    {kind === 'glass'
      ? <Glass level="control" r={shell.borderRadius as number}>{body}</Glass>
      : <View style={[shell, kind === 'filled' && { backgroundColor: c.action }, kind === 'tinted' && { backgroundColor: c.successSoft }, kind === 'destructive' && { backgroundColor: c.dangerSoft }]}>{body}</View>}
  </Tap>;
}

/** Round glass control for toolbars that float over content. */
export function GlassIcon({ name, label, onPress, size = 44 }: { name: GlyphName; label: string; onPress: () => void; size?: number }) {
  return <Tap label={label} onPress={onPress} ring={size / 2} scaleTo={.9}>
    <Glass level="control" r={size / 2} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Glyph name={name} size={20} />
    </Glass>
  </Tap>;
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: GlyphName }) {
  const { c } = useTheme();
  return <Tap role="radio" selected={selected} label={label} onPress={onPress} ring={radius.pill}
    style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: selected ? c.action : c.sunken }}>
    {icon && <Glyph name={icon} size={16} tone={selected ? c.onAction : c.ink2} />}
    <T v="subhead" style={{ color: selected ? c.onAction : c.ink, fontWeight: selected ? '600' : '400' }}>{label}</T>
  </Tap>;
}

/** iOS-style inset grouped list: rows share one rounded surface, separated by hairlines. */
export function Group({ header, footer, children }: React.PropsWithChildren<{ header?: string; footer?: string }>) {
  const { c } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return <View style={{ gap: space[2] }}>
    {header && <T v="footnote" tone="ink2" style={{ paddingHorizontal: space[4], fontWeight: '600' }}>{header}</T>}
    <View style={{ backgroundColor: c.raised, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
      {rows.map((row, i) => <View key={i}>
        {row}
        {i < rows.length - 1 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: space[4] + 32 }} />}
      </View>)}
    </View>
    {footer && <T v="footnote" tone="ink3" style={{ paddingHorizontal: space[4] }}>{footer}</T>}
  </View>;
}

export function Row({ icon, title, detail, value, onPress, trailing }: { icon?: GlyphName; title: string; detail?: string; value?: string; onPress?: () => void; trailing?: React.ReactNode }) {
  const { c } = useTheme();
  const body = <View style={{ minHeight: 56, paddingHorizontal: space[4], paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
    {icon && <View style={{ width: 20, alignItems: 'center' }}><Glyph name={icon} size={20} tone={c.ink2} /></View>}
    <View style={{ flex: 1, gap: 1 }}>
      <T v="body">{title}</T>
      {!!detail && <T v="footnote" tone="ink2">{detail}</T>}
    </View>
    {!!value && <T v="subhead" tone="ink2">{value}</T>}
    {trailing}
    {onPress && <Glyph name="forward" size={16} tone={c.ink3} />}
  </View>;
  return onPress ? <Tap label={value ? `${title}, ${value}` : title} onPress={onPress} scaleTo={.985} ring={radius.card}>{body}</Tap> : body;
}

export function Field({ label, value, onChangeText, placeholder, numeric, autoFocus, onSubmitEditing, maxLength = 100, help }: { label: string; value: string; onChangeText: (s: string) => void; placeholder?: string; numeric?: boolean; autoFocus?: boolean; onSubmitEditing?: () => void; maxLength?: number; help?: string }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return <View style={{ gap: 6 }}>
    <T v="footnote" tone="ink2" style={{ fontWeight: '600' }}>{label}</T>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.ink3}
      keyboardType={numeric ? 'number-pad' : 'default'} autoFocus={autoFocus} onSubmitEditing={onSubmitEditing} maxLength={maxLength} returnKeyType="done"
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} maxFontSizeMultiplier={1.5}
      style={[type.body, { color: c.ink, minHeight: 52, paddingHorizontal: space[4], borderRadius: radius.input, borderCurve: 'continuous', backgroundColor: c.sunken, borderWidth: 2, borderColor: focus ? c.leafMark : 'transparent' }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} />
    {!!help && <T v="footnote" tone="ink3">{help}</T>}
  </View>;
}

/** Where a fact comes from. Sentence case, a glyph and one colour per source. */
export type Source = 'observed' | 'told' | 'species' | 'suggested' | 'off';
const sources: Record<Source, { text: string; icon: GlyphName; tone: Tone }> = {
  observed: { text: 'You observed', icon: 'leaf', tone: 'leafText' },
  told: { text: 'You told us', icon: 'edit', tone: 'ink2' },
  species: { text: 'Species note', icon: 'book', tone: 'ink2' },
  suggested: { text: 'Rootera suggests', icon: 'spark', tone: 'ink2' },
  off: { text: 'Not connected', icon: 'info', tone: 'ink3' },
};
export function SourceLabel({ kind, text }: { kind: Source; text?: string }) {
  const { c } = useTheme();
  const s = sources[kind];
  return <View accessible accessibilityLabel={`Source: ${text ?? s.text}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
    <Glyph name={s.icon} size={14} tone={c[s.tone]} />
    <T v="footnote" tone={s.tone} style={{ fontWeight: '600' }}>{text ?? s.text}</T>
  </View>;
}

/** A real number with its unit; tabular so values don't jump. */
export function Figure({ value, unit, caption }: { value: string; unit?: string; caption: string }) {
  return <View style={{ gap: 2 }}>
    <T v="figure" lines={1}>{value}{!!unit && <T v="subhead" tone="ink2"> {unit}</T>}</T>
    <T v="footnote" tone="ink2">{caption}</T>
  </View>;
}

export function Segmented<V extends string>({ values, value, onChange, labels }: { values: readonly V[]; value: V; onChange: (v: V) => void; labels?: Partial<Record<V, string>> }) {
  const { c } = useTheme();
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: c.sunken }}>
    {values.map(v => <Tap key={v} role="tab" selected={v === value} label={labels?.[v] ?? v} onPress={() => onChange(v)} style={{ flex: 1 }} ring={radius.pill}>
      <View style={[{ minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[3] }, v === value && { backgroundColor: c.raised, ...elevation.lift, shadowColor: c.shadow }]}>
        <T v="subhead" style={{ fontWeight: v === value ? '600' : '400' }}>{labels?.[v] ?? v}</T>
      </View>
    </Tap>)}
  </View>;
}

/** Floating confirmation on glass. The caller decides when it appears and leaves. */
export function Toast({ title, text, tone = 'success', onClose, action }: { title: string; text?: string; tone?: 'success' | 'error' | 'info'; onClose?: () => void; action?: { title: string; onPress: () => void } }) {
  const { c } = useTheme();
  const icon: GlyphName = tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'info';
  const accent = tone === 'success' ? c.leafMark : tone === 'error' ? c.danger : c.ink2;
  return <Glass level="control" r={radius.card} style={{ padding: space[4], flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
    <View accessibilityLiveRegion="polite" accessibilityRole={tone === 'error' ? 'alert' : undefined} style={{ flex: 1, flexDirection: 'row', gap: space[3] }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}><Glyph name={icon} size={16} tone={c.canvas} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="headline">{title}</T>
        {!!text && <T v="subhead" tone="ink2">{text}</T>}
        {action && <Tap label={action.title} onPress={action.onPress} style={{ alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' }}><T v="subhead" tone="leafText" style={{ fontWeight: '600' }}>{action.title}</T></Tap>}
      </View>
    </View>
    {onClose && <Tap label="Dismiss" onPress={onClose} ring={18} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -6 }}><Glyph name="close" size={16} tone={c.ink2} /></Tap>}
  </Glass>;
}

export interface TabItem { key: string; label: string; icon: GlyphName }
/** Floating glass tab bar: lifted off the bottom edge, the selected tab gets a solid pill. */
export function FloatingTabBar({ items, active, onSelect, bottomInset }: { items: TabItem[]; active: string; onSelect: (key: string) => void; bottomInset: number }) {
  const { c } = useTheme();
  return <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(bottomInset, space[3]), alignItems: 'center' }}>
    <Glass level="chrome" r={radius.chrome} style={{ flexDirection: 'row', padding: 6, gap: 2 }}>
      {items.map(t => {
        const on = t.key === active;
        return <Tap key={t.key} role="tab" selected={on} label={t.label} onPress={() => onSelect(t.key)} ring={radius.chrome - 6} scaleTo={.92}>
          <View style={{ minWidth: 72, height: 52, borderRadius: radius.chrome - 6, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? c.sunken : 'transparent' }}>
            <Glyph name={t.icon} size={22} filled={on} tone={on ? c.ink : c.ink2} />
            <T v="caption" style={{ color: on ? c.ink : c.ink2, fontWeight: on ? '700' : '500' }}>{t.label}</T>
          </View>
        </Tap>;
      })}
    </Glass>
  </View>;
}
