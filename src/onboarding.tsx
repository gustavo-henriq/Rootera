import React, { useEffect, useState, useRef } from 'react';
import { BackHandler, Image, Pressable, View } from 'react-native';
import { Button, C, Enter, Field, Logo, Notice, Page, Title, Txt, s } from './ui';
import { Props } from './navigation';
import { useStore } from './store';
import { Choices, StepLabel } from './conversation';
import { NotificationStack, PlantAssembly } from './motion';
export function Welcome({navigation}:Props<'Welcome'>) {
 const {data,update}=useStore();const [name,setName]=useState(data.name);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
 const open=async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{await update(d=>({...d,name:name.trim()||d.name,onboarded:true}));navigation.reset({index:0,routes:[{name:'Main'}]});}catch(e){setError(e instanceof Error?e.message:'Could not open your garden.');}finally{lock.current=false;setBusy(false);}};
 return <Page center footer={<View style={{gap:12}}><Button title={busy?'Opening…':'Open my garden'} disabled={busy} onPress={()=>void open()}/><Txt small style={s.sub}>Preview access · account sign-in is not connected yet.</Txt></View>}><View style={{alignItems:'center',gap:12}}><Image source={require('../assets/welcome-reference.png')} style={{width:160,height:230}} resizeMode="contain"/><Logo large/><Txt style={s.sub}>Care that starts with your observations.</Txt></View><Field label="Your name" value={name} onChangeText={setName}/>{!!error&&<Txt style={{color:C.orange}}>{error}</Txt>}</Page>;
}
export function Email({navigation}:Props<'Email'>){const [name,setName]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const {data,update}=useStore();return <Page back={navigation.goBack} center footer={<Button title={busy?'Opening your garden…':'Continue to demo'} disabled={!name.trim()||busy} onPress={async()=>{setBusy(true);try{await update(d=>({...d,name:name.trim()}));navigation.reset({index:data.plants.length?0:1,routes:data.plants.length?[{name:'Main'}]:[{name:'Main'},{name:'AddPlant'}]});}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}}/>}><Logo/><Title>Make yourself at home</Title><Field label="Your name" value={name} onChangeText={setName}/><Notice title="Demo access" text="Sign-in is not connected yet. Explore without a password."/>{!!error&&<Txt style={{color:C.orange}}>{error}</Txt>}</Page>;}
const experienceOptions=['Just starting','I know the basics','Pretty experienced','Plant nerd'];
export function Onboarding({navigation,route}:Props<'Onboarding'>) {
 const {data,update}=useStore();const replay=!!route.params?.replay;const [step,setStep]=useState(replay?2:0);const [experience,setExperience]=useState(data.caregiver?.experience??'');const [count,setCount]=useState(data.caregiver?.plant_count??'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
 const finish=async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{await update(d=>({...d,caregiver:{experience:experience||'Just starting',plant_count:count||'1–3',detail:d.caregiver?.detail??(['Pretty experienced','Plant nerd'].includes(experience)?'Concise':'Guided')}}));if(replay)navigation.goBack();else navigation.reset({index:0,routes:[{name:'Welcome'}]});}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{lock.current=false;setBusy(false);}};
 const first=replay?2:0;
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{if(busy)return true;if(step>first){setStep(v=>v-1);return true;}return false;});return()=>sub.remove();},[step,busy,first]);
 return <Page back={step>first?()=>!busy&&setStep(step-1):navigation.canGoBack()?navigation.goBack:undefined} right={step<2?<Pressable accessibilityRole="button" onPress={()=>setStep(2)} style={{padding:12}}><Txt small style={s.link}>Skip intro</Txt></Pressable>:undefined}
 footer={<Button title={busy?'Saving…':step<3?'Continue':replay?'Save profile':'Continue to my profile'} disabled={busy||(step===2&&!experience)||(step===3&&!count)} onPress={()=>step<3?setStep(step+1):void finish()}/>}>
 <StepLabel step={step-first+1} total={4-first} label={step<2?'Welcome to Rootera':'Your gardening profile'}/>
 <Enter key={step}><View style={{gap:20,paddingTop:16}}>
 {step===0?<><PlantAssembly/><Title center>Get to know your plant.</Title><Txt style={s.sub}>Its soil, its light, and the care you give. Rootera brings your observations together to help you decide what comes next.</Txt></>:
 step===1?<><Title>Notice what matters.</Title><Txt style={{color:C.muted}}>Clear prompts, based on what you tell us. Every suggestion explains why.</Txt><NotificationStack/><Txt small style={s.sub}>Examples of care prompts. No fixed watering schedule.</Txt></>:
 step===2?<><Title>How familiar are you with plant care?</Title><Txt style={{color:C.muted}}>This helps us choose how much explanation to give.</Txt><Choices options={experienceOptions} value={experience} onChange={setExperience}/></>:
 <><Title>How many plants do you care for?</Title><Txt style={{color:C.muted}}>An estimate is fine. You’ll add plants individually next.</Txt><Choices options={['1–3','4–10','10+']} value={count} onChange={setCount}/></>}
 {!!error&&<Txt style={{color:C.orange}}>{error}</Txt>}</View></Enter></Page>;
}
