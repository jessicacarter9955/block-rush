'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createGameRecorder } from '@/lib/recording';
import { BP } from '@/lib/bp';

type Job = { id:string; title:string; state:string; error?:string };
type Status = { token:string; mode:string; ffmpeg:boolean; postiz:boolean; liveConfigured:boolean; liveState:string; channels:{id:string;provider:string}[]; jobs:Job[] };

export function PublisherPanel({ area, startBot, recorderBusy, onBusyChange, bot }: {
  area: { current:HTMLDivElement|null }; startBot: () => Promise<void>; recorderBusy:boolean; onBusyChange:(busy:boolean)=>void;
  bot: { running:boolean; speed:number; score:number; moves:number; lines:number };
}) {
  const [visible,setVisible]=useState(false),[status,setStatus]=useState<Status|null>(null);
  const [message,setMessage]=useState('Connecting to the local publisher…');
  const [count,setCount]=useState(5),[seconds,setSeconds]=useState(30),[audio,setAudio]=useState(true);
  const [active,setActive]=useState<'batch'|'live'|null>(null),[elapsed,setElapsed]=useState(0),[saved,setSaved]=useState(0);
  const [starting,setStarting]=useState(false);
  const stopRef=useRef<(()=>void)|null>(null),socketRef=useRef<WebSocket|null>(null);
  const mounted=useRef(true),uploadChain=useRef(Promise.resolve());
  const poll=useCallback(async()=>{
    try{
      const response=await fetch('/api/publisher/status',{cache:'no-store'});
      if(!response.ok)throw new Error('Start npm run publisher to use batch publishing and live.');
      const next=await response.json() as Status;
      if(mounted.current){setStatus(next);setMessage(next.mode==='local'?'Local mode: clips stay on this PC.':`${next.mode}: ${next.channels.length} connected destinations`);}
    }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:String(error));}
  },[]);
  useEffect(()=>{
    mounted.current=true;
    const enabled=new URLSearchParams(location.search).get('publisher')==='1';setVisible(enabled);
    if(!enabled)return;
    if(location.hostname!=='127.0.0.1'||location.port!=='8765'){setMessage('Open http://127.0.0.1:8765/play/?bot=1&speed=4&publisher=1 after starting the local worker.');return;}
    void poll();const interval=setInterval(()=>void poll(),5000);
    return()=>{mounted.current=false;clearInterval(interval);stopRef.current?.();socketRef.current?.close();};
  },[poll]);
  const telemetry=useRef({bot,active,elapsed,saved});
  telemetry.current={bot,active,elapsed,saved};
  useEffect(()=>{
    if(!visible||!status?.token)return;
    const send=()=>{const value=telemetry.current;void fetch('/api/publisher/telemetry',{method:'POST',headers:{Authorization:`Bearer ${status.token}`,'Content-Type':'application/json'},
      body:JSON.stringify({botRunning:value.bot.running,speed:value.bot.speed,score:value.bot.score,moves:value.bot.moves,lines:value.bot.lines,capture:value.active,elapsed:value.elapsed,clips:value.saved})}).catch(()=>{});};
    send();const timer=setInterval(send,5000);return()=>clearInterval(timer);
  },[visible,status?.token]);

  const capture=async(live:boolean)=>{
    if(!area.current||!status||starting||active||recorderBusy)return;
    setStarting(true);onBusyChange(true);setElapsed(0);setSaved(0);
    let socket:WebSocket|null=null;
    try{
      if(live){
        socket=new WebSocket(`ws://${location.host}/api/publisher/live?token=${encodeURIComponent(status.token)}`);
        socketRef.current=socket;
        await new Promise<void>((resolve,reject)=>{
          const timer=setTimeout(()=>{socket?.close();reject(new Error('Live encoder did not become ready.'));},10000);
          socket!.onmessage=event=>{try{if(JSON.parse(event.data).ready){clearTimeout(timer);resolve();}}catch{}};
          socket!.onerror=()=>{clearTimeout(timer);reject(new Error('Live connection failed. Check RTMP settings.'));};
          socket!.onclose=()=>{clearTimeout(timer);reject(new Error('Live encoder stopped before capture.'));};
        });
        socket.onclose=()=>{stopRef.current?.();if(mounted.current)setMessage('Live feed disconnected. Check the destination dashboard.');};
      }
      const stop=await createGameRecorder({element:area.current,audio,onTime:s=>{if(mounted.current)setElapsed(s);},
        segmentSeconds:live?undefined:seconds,maxSegments:live?1:count,
        onChunk:live?chunk=>{
          if(socket?.readyState!==WebSocket.OPEN)throw new Error('Live feed disconnected.');
          if(socket.bufferedAmount>8*1024*1024)throw new Error('Connection cannot keep up with the live video.');
          socket.send(chunk);
        }:undefined,
        onComplete:(blob,duration)=>{
          const id=crypto.randomUUID();
          uploadChain.current=uploadChain.current.then(async()=>{
            const response=await fetch(`/api/publisher/clip?id=${id}&duration=${duration}`,{method:'POST',headers:{Authorization:`Bearer ${status.token}`,'Content-Type':blob.type},body:blob});
            if(!response.ok)throw new Error('Clip transfer failed. Batch stopped; check the local worker.');
            if(mounted.current){setSaved(n=>n+1);void poll();}
          }).catch(error=>{stopRef.current?.();if(mounted.current)setMessage(error.message);});
        },
        onError:error=>{if(mounted.current)setMessage(error);},
        onStopped:()=>{stopRef.current=null;socket?.close();socketRef.current=null;onBusyChange(false);if(mounted.current){setActive(null);setStarting(false);}},
      });
      if(!mounted.current){stop();return;}
      stopRef.current=stop;setActive(live?'live':'batch');
      await startBot();
    }catch(error){stopRef.current?.();socket?.close();onBusyChange(false);if(mounted.current)setMessage(error instanceof Error?error.message:String(error));}
    finally{if(mounted.current)setStarting(false);}
  };
  const download=async(job:Job)=>{
    if(!status)return;
    try{
      const response=await fetch(`/api/publisher/download/${job.id}`,{headers:{Authorization:`Bearer ${status.token}`}});
      if(!response.ok)throw new Error('The MP4 is not ready yet.');
      const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=`blockrush-${job.id}.mp4`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(error){setMessage(error instanceof Error?error.message:String(error));}
  };
  if(!visible)return null;
  const disabled=Boolean(active||starting||recorderBusy||!status?.ffmpeg);
  return <section aria-label="Batch publisher and live" className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-950/60 p-3 text-xs text-white">
    <h2 className="mb-2 font-black text-cyan-200">BATCH PUBLISHER + LIVE</h2>
    <a href={`${BP}/publisher/`} target="_blank" rel="noopener" className="mb-3 block rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-center font-bold text-cyan-100">OPEN PUBLISHING DASHBOARD ↗</a>
    <p role="status" className="mb-3 text-[11px] text-white/70">{message}</p>
    <div className="mb-2 grid grid-cols-2 gap-2">
      <label>Clips<input aria-label="Number of clips" disabled={disabled} type="number" min={1} max={50} value={count} onChange={e=>setCount(Math.max(1,Math.min(50,Number(e.target.value)||1)))} className="mt-1 w-full rounded bg-black/30 p-2"/></label>
      <label>Seconds per clip<input aria-label="Clip duration" disabled={disabled} type="number" min={6} max={60} value={seconds} onChange={e=>setSeconds(Math.max(6,Math.min(60,Number(e.target.value)||30)))} className="mt-1 w-full rounded bg-black/30 p-2"/></label>
    </div>
    <label className="mb-3 flex gap-2"><input type="checkbox" checked={audio} disabled={disabled} onChange={e=>setAudio(e.target.checked)}/>Include tab audio</label>
    {active?<button onClick={()=>stopRef.current?.()} className="w-full rounded-lg bg-red-600 p-2 font-bold">STOP {active.toUpperCase()} · {Math.floor(elapsed)}s</button>:<div className="grid gap-2">
      <button disabled={disabled} onClick={()=>void capture(false)} className="rounded-lg bg-cyan-700 p-2 font-bold disabled:opacity-40">{starting?'SELECT THE GAME TAB…':`RECORD ${count} CLIPS`}</button>
      <button disabled={disabled||!status?.liveConfigured} onClick={()=>void capture(true)} className="rounded-lg bg-red-700 p-2 font-bold disabled:opacity-40">SEND LIVE FEED</button>
    </div>}
    <p className="mt-2 text-[10px] text-white/60">Choose this browser tab once and keep the game fully visible. {saved} clips transferred. Keep this PC awake. Live status: {status?.liveState||'not connected'}.</p>
    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">{status?.jobs.map(job=><div key={job.id} className="rounded bg-black/20 p-2"><div className="truncate text-[10px]">{job.title}</div><div className="flex justify-between text-cyan-200"><span>{job.state}</span>{['ready','draft','scheduled','unknown'].includes(job.state)&&<button onClick={()=>void download(job)}>Download MP4</button>}</div>{job.error&&<p className="text-[10px] text-red-300">{job.error}</p>}</div>)}</div>
  </section>;
}
