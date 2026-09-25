import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView, BlurTargetView } from 'expo-blur';
import { C, Icon, PlantImage, Txt, useReducedMotion } from './ui';
const ease = Easing.bezier(.23, 1, .32, 1);
const notices = [
 { title: 'Time for a soil check?', text: 'Aloe Vera has no recent check. Feel below the surface before watering.', kind: 'aloe' as const, warning: false },
 { title: 'The soil is still moist.', text: 'Your Peace Lily check is saved. Give it time before adding more water.', kind: 'peace-lily' as const, warning: false },
 { title: 'Watering recorded.', text: 'Your next Monstera check will help us follow how the soil changes.', kind: 'monstera' as const, warning: false },
];
function NotificationItem({ index, active, reduce }: { index: number; active: number; reduce: boolean }) {
 const target = useRef<View>(null); const y = useSharedValue(210); const opacity = useSharedValue(0); const scale = useSharedValue(1); const age = active-index; const n = notices[index];
 useEffect(() => { const toY = age < 0 ? 230 : 160-Math.max(0,age)*70; const toOpacity=age<0?0:age===0?1:.87; const toScale=1-Math.max(0,age)*.035;
 y.value=reduce?0:withTiming(toY,{duration:280,easing:ease}); opacity.value=withTiming(reduce?1:toOpacity,{duration:reduce?120:240}); scale.value=reduce?1:withTiming(toScale,{duration:280,easing:ease});
 return () => {cancelAnimation(y);cancelAnimation(opacity);cancelAnimation(scale);}; },[active,reduce]);
 const style=useAnimatedStyle(()=>({opacity:opacity.value,transform:[{translateY:y.value},{scale:scale.value}]}));
 return <Animated.View accessibilityElementsHidden={age<0} importantForAccessibility={age<0?'no-hide-descendants':'auto'} style={[m.notification,{zIndex:index, backgroundColor:n.warning?'#FFF0E9':'#ECF4E4',borderColor:n.warning?'#F0DDD5':'#DEE8D4'},style,reduce&&{position:'relative',opacity:1,transform:[]}]}>
 <PlantImage kind={n.kind} size={58}/><View style={{flex:1,overflow:'hidden',borderRadius:5}}><BlurTargetView ref={target}><Txt style={{fontFamily:'NunitoSans_700Bold',fontSize:14,lineHeight:19}}>{n.title}</Txt><Txt small style={{fontSize:12,lineHeight:17,color:'#555C49'}}>{n.text}</Txt></BlurTargetView>{age>0 && !reduce && <BlurView pointerEvents="none" blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" tint="extraLight" intensity={age===1?5:9} style={[StyleSheet.absoluteFill,{opacity:.65}]}/>}</View>
 {age>0 && !reduce && <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:'#374326',opacity:age===1?.07:.12,borderRadius:16}]}/>}</Animated.View>;
}
export function NotificationStack(){const reduce=useReducedMotion();const [active,setActive]=useState(0);useEffect(()=>{if(reduce){setActive(2);return;}setActive(0);const a=setTimeout(()=>setActive(1),1900);const b=setTimeout(()=>setActive(2),3900);return()=>{clearTimeout(a);clearTimeout(b);};},[reduce]);return <View style={{height:reduce?undefined:300,gap:10, width:'100%'}}>{notices.map((_,i)=><NotificationItem key={i} index={i} active={active} reduce={reduce}/>)}</View>;}
export function PlantAssembly(){const reduce=useReducedMotion();const pot=useSharedValue(-290);const foliage=useSharedValue(-340);const sway=useSharedValue(0);useEffect(()=>{if(reduce){pot.value=0;foliage.value=0;sway.value=0;return;}pot.value=-290;foliage.value=-340;sway.value=0;pot.value=withTiming(0,{duration:340,easing:Easing.in(Easing.quad)});foliage.value=withDelay(340,withTiming(0,{duration:380,easing:Easing.in(Easing.quad)}));sway.value=withDelay(710,withSequence(withTiming(4,{duration:100}),withSpring(0,{damping:7,stiffness:170})));return()=>{cancelAnimation(pot);cancelAnimation(foliage);cancelAnimation(sway);};},[reduce]);const ps=useAnimatedStyle(()=>({transform:[{translateY:pot.value}]}));const fs=useAnimatedStyle(()=>({transform:[{translateY:foliage.value},{rotate:`${sway.value}deg`}]}));return <View style={{width:270,height:290,overflow:'hidden',alignSelf:'center'}} accessibilityLabel="Aloe vera settling into its pot"><Animated.Image source={require('../assets/aloe-pot-reference.png')} resizeMode="contain" style={[{position:'absolute',width:130,height:103,left:70,bottom:6},ps]}/><Animated.Image source={require('../assets/aloe-foliage-reference.png')} resizeMode="contain" style={[{position:'absolute',width:242,height:208,left:14,bottom:88},fs]}/></View>;}
function GrowthStage({index,percent,day}:{index:number;percent:number;day:number}){const reduce=useReducedMotion();const scale=useSharedValue(.8);const opacity=useSharedValue(0);useEffect(()=>{scale.value=reduce?1:withDelay(index*360,withTiming(1,{duration:280,easing:ease}));opacity.value=reduce?1:withDelay(index*360,withTiming(1,{duration:220}));},[reduce]);const style=useAnimatedStyle(()=>({opacity:opacity.value,transform:[{scale:scale.value}]}));return <Animated.View style={[{flex:1,alignItems:'center',gap:6},style]}><View style={{height:122,justifyContent:'flex-end'}}><PlantImage size={76+index*17}/></View><View style={{backgroundColor:'#DCEACD',paddingVertical:4,paddingHorizontal:17,borderRadius:20}}><Txt small style={{fontFamily:'NunitoSans_700Bold',color:C.ink,fontVariant:['tabular-nums']}}>{percent}%</Txt></View><Txt small>Day {day}</Txt></Animated.View>;}
export function LearningStages(){return <View style={{flexDirection:'row',alignItems:'center',width:'100%'}}><GrowthStage index={0} percent={52} day={1}/><Icon name="arrow-forward" size={20}/><GrowthStage index={1} percent={68} day={7}/><Icon name="arrow-forward" size={20}/><GrowthStage index={2} percent={84} day={30}/></View>;}
export function SensorBars(){const reduce=useReducedMotion();const progress=useSharedValue(0);useEffect(()=>{progress.value=reduce?1:withTiming(1,{duration:650,easing:ease});},[reduce]);const style=useAnimatedStyle(()=>({opacity:progress.value,transform:[{scaleY:.4+.6*progress.value}]}));return <Animated.View style={[{flexDirection:'row',gap:5,alignItems:'flex-end',height:35},style]}>{[10,14,21,26,30,34].map((h,i)=><View key={i} style={{height:h,width:6,borderRadius:3,backgroundColor:i===0||i===5?'#E0E2DB':C.green}}/>)}</Animated.View>;}
const m=StyleSheet.create({notification:{position:'absolute',left:0,right:0,padding:12,borderWidth:1,borderRadius:16,borderCurve:'continuous',flexDirection:'row',alignItems:'center',gap:10,minHeight:99}});

/** A single confirmation pulse, reserved for a successful save or activation. */
export function SuccessMark({size=64}:{size?:number}) {
 const reduce=useReducedMotion();const progress=useSharedValue(1);
 useEffect(()=>{progress.value=reduce?1:.88;if(!reduce)progress.value=withSequence(withTiming(1.06,{duration:180,easing:ease}),withTiming(1,{duration:120,easing:ease}));return()=>cancelAnimation(progress);},[reduce]);
 const style=useAnimatedStyle(()=>({transform:[{scale:progress.value}]}));
 return <Animated.View style={style}><Icon name="checkmark-circle" size={size} color={C.green}/></Animated.View>;
}
export function MoistureProgress({value}:{value:number|null}) {
 const reduce=useReducedMotion();const progress=useSharedValue(0);
 useEffect(()=>{const next=(value??0)/100;progress.value=reduce?next:withTiming(next,{duration:240,easing:ease});return()=>cancelAnimation(progress);},[value,reduce]);
 const style=useAnimatedStyle(()=>({transform:[{scaleX:progress.value}]}));
 return <View accessibilityRole="progressbar" accessibilityValue={value===null?{text:'Invalid sample'}:{min:0,max:100,now:value}} style={{height:8,backgroundColor:C.pale,borderRadius:8,overflow:'hidden'}}><Animated.View style={[{height:8,backgroundColor:C.green,borderRadius:8,transformOrigin:'left center'},style]}/></View>;
}
