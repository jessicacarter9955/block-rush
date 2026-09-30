'use client';
import {useId} from 'react';
import {Play,RotateCcw,Home,Trophy,X,Music,Volume2,Pause,VolumeX,Music2,User,Check, type LucideIcon} from 'lucide-react';
import {pos} from './Kit';
import {BP} from '@/lib/bp';
import {fontCss} from '@/lib/skin';
import rankingSeed from '../../../public/ranking.json';

export function Crown({size=158}:{size?:number}) {
 return <img width={size} height={size} src={`${BP}/textures/rush/crown-hd.png`} alt="Best score" draggable={false} style={{width:size,height:size,objectFit:'contain',display:'block'}}/>;
}
export function Gem({color='#5cdff4',size=100}:{color?:string;size?:number}) {
 const id=useId();return <svg width={size} height={size} viewBox="-56 -56 112 112" aria-hidden="true" style={{overflow:'visible'}}><defs><linearGradient id={id} x2="1" y2="1"><stop stopColor="white" stopOpacity=".5"/><stop offset=".5" stopColor={color}/><stop offset="1" stopColor="#4617a3"/></linearGradient></defs><path d="M-28-46H26L46-25V26L24 47H-28L-47 25V-24Z" fill={color}/><path d="M-28-46H26L17-27H-18Z" fill="white" opacity=".7"/><path d="M-47-24L-28-46L-18-27L-28-15V16L-47 25Z" fill="white" opacity=".38"/><path d="M26-46L46-25V26L27 16V-15L17-27Z" fill="#23105e" opacity=".44"/><path d="M-47 25L-28 47H24L46 26L27 16L15 28H-17L-28 16Z" fill="#170b50" opacity=".55"/><path d="M-18-27H17L27-15V16L15 28H-17L-28 16V-15Z" fill={`url(#${id})`} stroke="#ffffff90" strokeWidth="1.5"/><path d="M-28-46H26" stroke="white" strokeWidth="3"/><path d="M-29-40L-27-30L-17-28L-27-26L-29-16L-31-26L-41-28L-31-30Z" fill="white"/></svg>;
}

export function Action({label,icon:Icon=Play,onClick,x=540,y=730,w=712,h=142,primary=false,font=46}:{label:string;icon?:LucideIcon;onClick:()=>void;x?:number;y?:number;w?:number;h?:number;primary?:boolean;font?:number}) {
 return <button className="rush-action" onClick={onClick} style={{...pos(x,y,w,h),borderRadius:primary?38:26,border:`${primary?4:2}px solid ${primary?'#ffe999':'#5b82ba'}`,background:primary?'linear-gradient(#ffd34d,#ffb21c,#f18a0d)':'linear-gradient(#2d559a,#21417d)',boxShadow:`0 8px 0 ${primary?'#af590b':'#091735'}`,color:'white',display:'flex',alignItems:'center',justifyContent:'center',gap:font*.32,...fontCss('luckiest',font),cursor:'pointer'}}><Icon size={font*1.25}/>{label}</button>;
}
export function Round({kind,onClick,x,y,size=176,on=true}:{kind:'close'|'pause'|'ranking'|'sfx'|'music';onClick:()=>void;x:number;y:number;size?:number;on?:boolean}) {
 const Icon=kind==='close'?X:kind==='pause'?Pause:kind==='ranking'?Trophy:kind==='sfx'?(on?Volume2:VolumeX):(on?Music:Music2);
 return <button aria-label={kind} className="rush-action" onClick={onClick} style={{...pos(x,y,size,size),borderRadius:size*.32,background:on?'linear-gradient(135deg,#4967c4,#253a82)':'#293c65',border:'3px solid #89aeff',boxShadow:'0 6px 0 #070f33',color:on?'white':'#94a6c6',display:'grid',placeItems:'center',cursor:'pointer'}}><Icon size={size*.53}/></button>;
}
export function Panel({children,w=884,h=1200,y=960}:{children:React.ReactNode;w?:number;h?:number;y?:number}) {
 return <div style={{position:'absolute',inset:0,background:'#08102bbf',zIndex:85}}><div style={{...pos(540,y,w,h),borderRadius:54,border:'3px solid #527bb8',background:'linear-gradient(135deg,#173c7d,#102653,#0b183c)',boxShadow:'0 16px 0 #040b2466'}}/>{children}</div>;
}
export function Label({text,y,size=36,title=false,color='#f4f8ff'}:{text:string;y:number;size?:number;title?:boolean;color?:string}) {
 return <div style={{...pos(540,y,820,size*1.5),display:'grid',placeItems:'center',textAlign:'center',color,...(title?fontCss('luckiest',size):{fontFamily:'Arial',fontSize:size,lineHeight:1.15})}}>{text}</div>;
}
function Setting({label,y,on,onClick,icon:Icon}:{label:string;y:number;on:boolean;onClick:()=>void;icon:LucideIcon}) {
 return <button onClick={onClick} role="switch" aria-checked={on} aria-label={label} style={{...pos(540,y,712,118),background:'#162f60',borderRadius:24,color:'#f4f8ff',display:'flex',alignItems:'center',gap:26,padding:'0 35px',fontFamily:'Arial',fontSize:38,cursor:'pointer'}}><Icon size={54} color="#a8c9ff"/>{label}<span style={{marginLeft:'auto',width:104,height:60,borderRadius:30,background:on?'#40c9cf':'#40557c',display:'flex',justifyContent:on?'flex-end':'flex-start',alignItems:'center',padding:7}}><span style={{background:'white',width:46,height:46,borderRadius:'50%',display:'grid',placeItems:'center',color:'#158c96'}}>{on?<Check size={30}/>:<X size={30}/>}</span></span></button>;
}
export function PauseMenu({resume,home,restart,ranking,music,sfx,musicOn,sfxOn}:{resume:()=>void;home:()=>void;restart:()=>void;ranking:()=>void;music:()=>void;sfx:()=>void;musicOn:boolean;sfxOn:boolean}) {
 return <Panel><Round kind="close" x={902} y={468} size={88} onClick={resume}/><Label text="PAUSED" y={500} size={76} title/><Label text="Ready when you are." y={573} size={34} color="#b7cdf4"/><Action label="RESUME" primary onClick={resume}/><Setting label="Sound effects" y={915} on={sfxOn} onClick={sfx} icon={Volume2}/><Setting label="Music" y={1050} on={musicOn} onClick={music} icon={Music}/><Action label="LEADERBOARD" icon={Trophy} y={1215} h={112} onClick={ranking}/><Action label="HOME" icon={Home} x={351} y={1390} w={334} h={122} font={34} onClick={home}/><Action label="RESTART" icon={RotateCcw} x={729} y={1390} w={334} h={122} font={34} onClick={restart}/></Panel>;
}
export function Ranking({best,onClose}:{best:number;onClose:()=>void}) {
 const days=(1757653239000-Date.now())/86400000;
 const rows=[...rankingSeed.Ranking.map((r,i)=>({name:r.Name,score:r.Best+Math.trunc((1100-days)*8.5*(i+1))})),{name:'You',score:best}].sort((a,b)=>b.score-a.score);
 return <Panel w={944} h={1600}><div style={pos(540,260,96,96)}><Trophy size={96} color="#ffd05a"/></div><Label text="LEADERBOARD" y={365} size={62} title/><Label text="A little better. Every round." y={432} size={32} color="#b7cdf4"/><Round kind="close" x={916} y={254} size={88} onClick={onClose}/><div style={{...pos(540,518,800,40),display:'flex',color:'#92b3e8',font:'25px Arial'}}><span style={{width:148}}>RANK</span><span style={{flex:1}}>PLAYER</span>BEST SCORE</div>{rows.slice(0,10).map((r,i)=><div key={r.name} style={{...pos(540,600+i*88,800,76),display:'flex',alignItems:'center',padding:'0 38px',borderRadius:20,background:r.name==='You'?'#20578b':i%2?'#142d62':'#193771',border:r.name==='You'?'2px solid #5dddeb':'none',font:'34px Arial',color:'white'}}><span style={{width:110,color:i<3?['#ffd05a','#dbe9ff','#ffb58b'][i]:'#92b3e8'}}>{i+1}</span><span style={{flex:1}}>{r.name}</span><strong>{r.score.toLocaleString('en-US')}</strong></div>)}<div style={{...pos(540,1579,800,138),border:'2px solid #5a91cd',borderRadius:26,background:'#244d89',display:'flex',alignItems:'center',gap:26,padding:32,color:'white',font:'32px Arial'}}><User size={62} color="#8cecf3"/><div style={{flex:1}}><small>YOUR BEST</small><br/>Rank #{rows.findIndex(r=>r.name==='You')+1}</div><strong style={{fontSize:46,color:'#ffd05a'}}>{best.toLocaleString('en-US')}</strong></div><Label text="Keep playing. Keep climbing." y={1698} size={28} color="#92b3e8"/></Panel>;
}
export function Reward({seconds,continueRun,end}:{seconds:number;continueRun:()=>void;end:()=>void}) {
 return <Panel y={960} h={1120}><div style={pos(540,610,130,130)}><Gem size={130}/></div><Label text="ONE MORE CHANCE" y={780} size={61} title/><Label text="Your next combo is waiting." y={867} color="#b7cdf4"/><Label text="Keep your score. Get fresh pieces." y={925} size={32} color="#b7cdf4"/><div style={{...pos(540,1060,136,136),borderRadius:'50%',background:`conic-gradient(#ffd05a ${seconds*36}deg,#324269 0)`,padding:8}}><div style={{borderRadius:'50%',background:'#102653',height:'100%',display:'grid',placeItems:'center',color:'white',...fontCss('luckiest',56)}}>{seconds}</div></div><Action label="FREE CONTINUE" y={1250} h={148} primary font={48} onClick={continueRun}/><Label text="No ad required in this preview" y={1353} size={27} color="#92b3e8"/><button onClick={end} style={{...pos(540,1440,500,90),color:'white',font:'bold 34px Arial',cursor:'pointer'}}>END RUN</button></Panel>;
}
export function EndRun({score,best,restart,home}:{score:number;best:number;restart:()=>void;home:()=>void}) {
 return <Panel y={980} h={1260}><div style={pos(540,535,205,176)}><Crown size={205}/></div><Label text="GREAT RUN!" y={710} size={80} title/><Label text="Every round is a fresh start." y={793} size={34} color="#b7cdf4"/><Label text="YOUR SCORE" y={905} size={30} color="#92b3e8"/><Label text={score.toLocaleString('en-US')} y={1020} size={112} title/><Label text={`BEST  ${best.toLocaleString('en-US')}`} y={1135} size={40} color="#ffd05a"/><Action label="PLAY AGAIN" icon={RotateCcw} y={1330} h={148} primary font={50} onClick={restart}/><Action label="HOME" icon={Home} y={1490} w={400} h={96} font={34} onClick={home}/></Panel>;
}
