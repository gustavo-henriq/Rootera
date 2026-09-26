/**
 * Shared-element flight: a plant's illustration travels from where it was tapped (a tile)
 * to where it lands on the next screen, so the page reads as "the plant I tapped, opened"
 * rather than a new place. Positions are window coordinates; the flyer converts them into
 * its own container. Transform-only (translate + scale), smooth spring, never under Reduce Motion.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PlantKind } from '../model';
import { PlantArt } from './plant';
import { springs } from './tokens';

export interface Rect { x: number; y: number; w: number; h: number }

/** Measure a view in window coordinates. */
export function measure(ref: React.RefObject<View | null>, done: (r: Rect) => void) {
  ref.current?.measureInWindow((x, y, w, h) => { if (w && h) done({ x, y, w, h }); });
}

export function Flight({ kind, photo, from, to, onDone }: { kind: PlantKind; photo?: string | null; from: Rect; to: Rect; onDone: () => void }) {
  const root = useRef<View>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const p = useSharedValue(0);
  useEffect(() => { measure(root, r => setOrigin({ x: r.x, y: r.y })); }, []);
  useEffect(() => {
    if (!origin) return;
    p.value = withSpring(1, { ...springs.smooth, overshootClamping: true });
    const t = setTimeout(onDone, 420);
    return () => clearTimeout(t);
  }, [origin]);
  const k = to.w / from.w;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (to.x - from.x) * p.value }, { translateY: (to.y - from.y) * p.value }, { scale: 1 + (k - 1) * p.value }],
  }));
  return <View ref={root} pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 30 }]}>
    {origin && <Animated.View style={[{ position: 'absolute', left: from.x - origin.x, top: from.y - origin.y, width: from.w, height: from.h, transformOrigin: 'top left' }, style]}>
      <PlantArt kind={kind} photo={photo} size={from.w} />
    </Animated.View>}
  </View>;
}
