'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Check, Heart, LoaderCircle, MessageCircle, Play, Send, ShieldCheck } from 'lucide-react';
import formats from '@/lib/social-formats.json';
import styles from './dashboard.module.css';

export type SocialExport = { formatId:string;framing:string;width:number;height:number;state:string;bytes?:number;error?:string };

export function SocialPreview({ id, token, exports: outputs = {}, refresh }: {
  id:string;token:string;exports?:Record<string,SocialExport>;refresh:()=>Promise<void>;
}) {
  const [formatId,setFormatId] = useState('youtube-shorts'), [framing,setFraming] = useState('safe');
  const [guide,setGuide] = useState(true), [source,setSource] = useState(''), [rendered,setRendered] = useState('');
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const exportController = useRef<AbortController|null>(null), renderedUrl = useRef('');
  const format = formats.find(item=>item.id===formatId)!;
  const key = `${formatId}-${framing}`, output = outputs[key];
  const pending = output?.state==='queued'||output?.state==='rendering';
  const vertical = format.height > format.width * 1.5;
  const margins = framing==='safe'?format.safe:{top:0,right:0,bottom:0,left:0};

  useEffect(()=>{
    const controller = new AbortController(); let url = '';
    setLoading(true);setError('');setSource('');
    void (async()=>{
      try {
        const response = await fetch(`/api/publisher/download/${id}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
        if(!response.ok)throw new Error('Could not load the original MP4.');
        const blob = await response.blob(); if(controller.signal.aborted)return;
        url=URL.createObjectURL(blob);setSource(url);
      } catch(cause) { if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Preview unavailable'); }
      finally { if(!controller.signal.aborted)setLoading(false); }
    })();
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[id,token]);
  useEffect(()=>{
    exportController.current?.abort();
    if(renderedUrl.current)URL.revokeObjectURL(renderedUrl.current);
    renderedUrl.current='';setRendered('');setError('');setBusy(false);
  },[formatId,framing]);
  useEffect(()=>()=>{exportController.current?.abort();if(renderedUrl.current)URL.revokeObjectURL(renderedUrl.current);},[]);

  const render = async()=>{
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/publisher/exports/${id}?${new URLSearchParams({format:formatId,framing})}`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});
      const value=await response.json();if(!response.ok)throw new Error(value.error||'Could not queue export');
      await refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:'Export failed');}
    finally {setBusy(false);}
  };
  const loadExport = async(download=false)=>{
    const useMedia=(url:string)=>{
      if(download){const link=document.createElement('a');link.href=url;link.download=`blockrush-${formatId}-${framing}-${id.slice(0,8)}.mp4`;link.click();}
      else setRendered(url);
    };
    if(renderedUrl.current){useMedia(renderedUrl.current);return;}
    const controller=new AbortController();exportController.current?.abort();exportController.current=controller;
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/publisher/download/${id}?${new URLSearchParams({format:formatId,framing})}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
      if(!response.ok)throw new Error('The social export is not ready.');
      const blob=await response.blob();if(controller.signal.aborted)return;
      const url=URL.createObjectURL(blob);renderedUrl.current=url;
      useMedia(url);
    }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Export unavailable');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  };

  return <section className={styles.socialPreview} aria-label="Social video preview">
    <div className={styles.socialHeading}><div><small>DESTINATION PREVIEW</small><h3>Make every frame fit.</h3></div><span>{format.ratio}</span></div>
    <label className={styles.formatLabel}>Social destination<select value={formatId} onChange={event=>setFormatId(event.target.value)}>{formats.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <div className={styles.framingButtons} aria-label="Video framing"><button aria-pressed={framing==='safe'} onClick={()=>setFraming('safe')}><ShieldCheck size={14}/>Protect gameplay</button><button aria-pressed={framing==='fit'} onClick={()=>setFraming('fit')}>Full frame</button></div>
    <div className={styles.socialStage} style={{aspectRatio:`${format.width}/${format.height}`,maxWidth:`${460*format.width/format.height}px`}}>
      <div className={styles.socialVideo} style={rendered?{inset:0}:{top:`${margins.top}%`,right:`${margins.right}%`,bottom:`${margins.bottom}%`,left:`${margins.left}%`}}>
        {source?<video key={rendered||source} src={rendered||source} autoPlay={Boolean(rendered)} controls playsInline preload="metadata"/>:<span className={styles.socialLoading}>{loading?<LoaderCircle className={styles.spin}/>:<Play/>}{loading?'Loading video…':'Preview unavailable'}</span>}
      </div>
      {guide&&<div className={styles.socialGuide} aria-hidden="true">
        <div className={styles.socialTop}><span>{format.platform}</span><span>•••</span></div>
        <div className={styles.guideBoundary} style={{top:`${format.safe.top}%`,right:`${format.safe.right}%`,bottom:`${format.safe.bottom}%`,left:`${format.safe.left}%`}}/>
        {vertical&&<div className={styles.socialRail}><Heart/><MessageCircle/><Send/></div>}
        <div className={`${styles.socialCaption} ${vertical?'':styles.compactCaption}`}><strong>@BlockRush</strong><span>One more combo. One more record. ✨</span><small>Original gameplay · BlockRush</small></div>
      </div>}
    </div>
    <div className={styles.previewMeta}><span>{format.width} × {format.height} · MP4 · 30 fps</span><span>{rendered?'Rendered file':'Framing preview'}</span></div>
    <label className={styles.guideToggle}><input type="checkbox" checked={guide} onChange={event=>setGuide(event.target.checked)}/>Show approximate app interface & safe area</label>
    <p className={styles.formatNote}>The whole board stays visible. {framing==='safe'?'Gameplay fits inside the guide area.':'Gameplay fills the available frame without cropping.'} App controls are a preview only and are never added to your export.</p>
    <div className={styles.socialExportActions}>
      {output?.state==='ready'?<><span className={styles.exportReady}><Check size={14}/>Export ready</span><button className={styles.button} disabled={busy} onClick={()=>void loadExport(false)}><Play size={14}/>Play export</button><button className={styles.primary} disabled={busy} onClick={()=>void loadExport(true)}><ArrowDownToLine size={14}/>Download {format.ratio}</button></>:<button className={styles.primary} disabled={busy||pending||loading} onClick={()=>void render()}>{pending||busy?<LoaderCircle size={15} className={styles.spin}/>:<ArrowDownToLine size={15}/>} {pending?`${output.state==='queued'?'Queued':'Rendering'} ${format.ratio}…`:`${output?.state==='failed'?'Retry':'Render'} ${format.label} MP4`}</button>}
    </div>
    {(error||output?.error)&&<p className={styles.errorText} role="alert">{error||output?.error}</p>}
  </section>;
}
