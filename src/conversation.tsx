import React from 'react';
import { Pressable, View } from 'react-native';
import { C, Icon, Txt, s } from './ui';

/** A single grouped choice list: selection is the emphasis, not five competing cards. */
export function Choices({options,value,onChange}:{options:readonly string[];value:string;onChange:(value:string)=>void}) {
 return <View style={{borderTopWidth:1,borderColor:C.border}}>{options.map(option=><Pressable key={option} accessibilityRole="radio" accessibilityLabel={option} accessibilityState={{checked:value===option}} onPress={()=>onChange(option)} style={({pressed})=>({minHeight:58,borderBottomWidth:1,borderColor:C.border,backgroundColor:pressed||value===option?C.pale:'transparent',paddingHorizontal:12,paddingVertical:16,flexDirection:'row',alignItems:'center',gap:12})}><Txt style={[{flex:1},value===option&&s.bold]}>{option}</Txt><Icon name={value===option?'checkmark-circle':'ellipse-outline'} color={value===option?C.dark:C.muted} size={20}/></Pressable>)}</View>;
}
export function StepLabel({step,total,label}:{step:number;total:number;label:string}) {
 return <View style={{gap:12}}><View style={s.split}><Txt small>{label}</Txt><Txt small>{step} / {total}</Txt></View><View style={{flexDirection:'row',gap:4}}>{Array.from({length:total},(_,i)=><View key={i} style={{flex:1,height:2,backgroundColor:i<step?C.dark:C.border}}/>)}</View></View>;
}
/** Underlined peer destinations, distinct from form answers. */
export function SectionTabs({values,value,onChange}:{values:string[];value:string;onChange:(value:string)=>void}) {
 return <View style={{flexDirection:'row',borderBottomWidth:1,borderColor:C.border}}>{values.map(v=><Pressable key={v} accessibilityRole="tab" accessibilityLabel={v} accessibilityState={{selected:v===value}} onPress={()=>onChange(v)} style={{flex:1,minHeight:48,justifyContent:'center',alignItems:'center',borderBottomWidth:2,borderBottomColor:value===v?C.dark:'transparent'}}><Txt small style={{color:value===v?C.ink:C.muted,fontFamily:value===v?'NunitoSans_700Bold':'NunitoSans_400Regular'}}>{v}</Txt></Pressable>)}</View>;
}
