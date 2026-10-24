'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Bot, Check, CheckCircle2, ChevronRight, Clock3, ExternalLink, Film, Gem, HardDrive, LayoutDashboard, ListVideo, LoaderCircle, Pause, Play, Radio, RefreshCw, Search, Send, ShieldAlert, SlidersHorizontal, Video, WifiOff, X, Youtube } from 'lucide-react';
import { BP } from '@/lib/bp';
import styles from './dashboard.module.css';

type Destination = {postId:string;integration:string;state:string;url?:string;error?:string};
type Job = {id:string;title:string;state:string;held?:boolean;recordingFailed?:boolean;error?:string;createdAt?:number;updatedAt?:number;scheduledAt:number;submittedAt?:number;preparedAt?:number;duration?:number;outputBytes?:number;lastCheckedAt?:number;destinations?:Destination[];receipts?:{postId:string;integration:string}[];history?:{at:number;state:string;note?:string}[]};
type Status = {token:string;mode:string;ffmpeg:boolean;postiz:boolean;channels:{id:string;provider:string;visibility?:string;name?:string;disabled?:boolean;verified?:boolean}[];jobs:Job[];matched:number;intervalMinutes:number;
  stats:{total:number;counts:Record<string,number>;held:number;bytes:number;seconds:number;active:string|null};
  worker:{paused:boolean;running:boolean;startedAt:number;now:number};remote:{checkedAt:number|null;error:string|null;syncing:boolean};
  liveConfigured:boolean;liveState:string;live:{startedAt:number|null;bytes:number;lastChunkAt:number|null};
  telemetry:{at:number;botRunning:boolean;speed:number;score:number;moves:number;lines:number;capture:string|null;elapsed:number;clips:number}|null};
type ParallelBatch = { id:string;active:boolean;state:string;count:number;seconds:number;startedAt:number|null;endsAt:number|null;completed:number;failed:number;error?:string };

const LABELS:Record<string,string>={starting:'Starting bot',recording:'Recording',captured:'Waiting',converting:'Converting',uploading:'Uploading',ready:'Ready',sending:'Submitting',draft:'Draft',scheduled:'Scheduled',published:'Published',failed:'Failed',unknown:'Needs review',remote_failed:'Platform error',partial:'Partly published'};
const number=(n=0)=>new Intl.NumberFormat('en').format(n);
const bytes=(n=0)=>n>=1073741824?`${(n/1073741824).toFixed(1)} GB`:n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.round(n/1024)} KB`;
const date=(value?:number|null)=>value?new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const duration=(value?:number)=>value?`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`:'—';
const safeUrl=(value?:string)=>{try{const url=new URL(value||'');return ['http:','https:'].includes(url.protocol)?url.href:undefined;}catch{return undefined;}};

function Badge({state,held}:{state:string;held?:boolean}){
  const tone=held?'held':['published','ready'].includes(state)?'good':['failed','unknown','remote_failed','partial'].includes(state)?'error':['starting','recording','converting','uploading','sending'].includes(state)?'active':'neutral';
  return <span className={`${styles.badge} ${styles[tone]}`}><i/>{held?'On hold':LABELS[state]||state}</span>;
}

export function PublisherDashboard(){
  const [data,setData]=useState<(Status&{parallel?:ParallelBatch|null})|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState('');
  const [parallelCount,setParallelCount]=useState(10),[parallelSeconds,setParallelSeconds]=useState(60);
  const [filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[refreshed,setRefreshed]=useState<number|null>(null);
  const [selected,setSelected]=useState<Job|null>(null),[preview,setPreview]=useState(''),[previewBusy,setPreviewBusy]=useState(false),[notice,setNotice]=useState('');
  const media=useRef(''),previewController=useRef<AbortController|null>(null),mounted=useRef(true),refreshGeneration=useRef(0),drawer=useRef<HTMLElement|null>(null),lastFocus=useRef<HTMLElement|null>(null);
  const limit=25;
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(search);setOffset(0);},250);return()=>clearTimeout(timer);},[search]);
  const refresh=useCallback(async()=>{
    const generation=++refreshGeneration.current;
    try{
      const response=await fetch(`/api/publisher/status?${new URLSearchParams({filter,q:query,offset:String(offset),limit:String(limit)})}`,{cache:'no-store'});
      if(!response.ok)throw new Error('The local publishing worker is unavailable.');
      const value=await response.json() as Status&{parallel?:ParallelBatch|null};
      if(!value.worker||!value.stats)throw new Error('Restart the publishing worker to load the dashboard update.');
      if(mounted.current&&generation===refreshGeneration.current){setData(value);setError('');setRefreshed(Date.now());}
    }catch(cause){if(mounted.current&&generation===refreshGeneration.current)setError(cause instanceof Error?cause.message:'Could not reach the publishing worker.');}
    finally{if(mounted.current&&generation===refreshGeneration.current)setLoading(false);}
  },[filter,query,offset]);
  useEffect(()=>{
    mounted.current=true;
    if(location.hostname!=='127.0.0.1'||location.port!=='8765'){setError('This dashboard connects to the local worker. Open it at http://127.0.0.1:8765/publisher/.');setLoading(false);return;}
    void refresh();const timer=setInterval(()=>void refresh(),5000);
    return()=>{mounted.current=false;clearInterval(timer);};
  },[refresh]);
  useEffect(()=>()=>{previewController.current?.abort();if(media.current)URL.revokeObjectURL(media.current);},[]);
  useEffect(()=>{if(selected){const latest=data?.jobs.find(j=>j.id===selected.id);if(latest)setSelected(latest);}},[data]);
  useEffect(()=>{
    if(!selected)return;
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setSelected(null);
      if(event.key==='Tab'){
        const items=drawer.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],video[controls],input:not(:disabled)');
        if(!items?.length)return;
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',keydown);return()=>{document.removeEventListener('keydown',keydown);lastFocus.current?.focus();};
  },[selected?.id]);
  const action=async(path:string,label:string)=>{
    if(!data||busy)return;
    setBusy(label);setNotice('');
    try{const response=await fetch(`/api/publisher/${path}`,{method:'POST',headers:{Authorization:`Bearer ${data.token}`}});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Command failed.');
      setNotice(label==='parallel'?'Parallel recording batch started.':label==='stop-parallel'?'Stopping the parallel recordings.':label==='sync'?'Publication status refreshed.':label==='pause'?'Queue paused. Any step already in progress will finish.':label==='resume'?'Queue resumed.':'Clip updated.');await refresh();
    }catch(cause){setNotice(cause instanceof Error?cause.message:'Command failed.');}
    finally{setBusy('');}
  };
  const openJob=(job:Job)=>{lastFocus.current=document.activeElement as HTMLElement;previewController.current?.abort();setPreviewBusy(false);if(media.current){URL.revokeObjectURL(media.current);media.current='';}setPreview('');setSelected(job);};
  const loadMedia=async(job:Job,download=false)=>{
    if(!data)return;
    if(download&&preview){const link=document.createElement('a');link.href=preview;link.download=`blockrush-${job.id}.mp4`;link.click();return;}
    previewController.current?.abort();const controller=new AbortController();previewController.current=controller;
    setPreviewBusy(true);setNotice('');
    try{
      const response=await fetch(`/api/publisher/download/${job.id}`,{headers:{Authorization:`Bearer ${data.token}`},signal:controller.signal});
      if(!response.ok)throw new Error('The MP4 is not ready or is no longer on disk.');
      const blob=await response.blob();if(controller.signal.aborted)return;
      if(media.current)URL.revokeObjectURL(media.current);
      const url=URL.createObjectURL(blob);media.current=url;
      if(download){const link=document.createElement('a');link.href=url;link.download=`blockrush-${job.id}.mp4`;link.click();}
      else setPreview(url);
    }catch(cause){if(!controller.signal.aborted)setNotice(cause instanceof Error?cause.message:'Could not load the clip.');}
    finally{if(!controller.signal.aborted)setPreviewBusy(false);}
  };
  const counts=data?.stats.counts||{},total=data?.stats.total||0;
  const telemetry=data?.telemetry,telemetryFresh=Boolean(telemetry&&Date.now()-telemetry.at<20000);
  const attention=(counts.failed||0)+(counts.unknown||0)+(counts.remote_failed||0)+(counts.partial||0);
  const chooseFilter=(value:string)=>{setFilter(value);setOffset(0);};
  const current=selected;
  const tabs=[['all','All clips'],['ready','Ready'],['scheduled','Scheduled'],['published','Published'],['failed','Failed'],['unknown','Needs review']];

  return <div className={styles.app}>
    <aside className={styles.sidebar}>
      <a className={styles.brand} href={`${BP}/publisher/`}><span className={styles.brandIcon}><Gem size={24}/></span><span>BlockRush<small>CREATOR STUDIO</small></span></a>
      <div className={styles.navLabel}>WORKSPACE</div>
      <a className={styles.navActive} href="#overview"><LayoutDashboard size={18}/>Overview</a>
      <a href="#queue"><ListVideo size={18}/>Publishing queue<span>{total}</span></a>
      <a href="#connections"><Send size={18}/>Connections</a>
      <a href={`${BP}/play/?bot=1&speed=4&publisher=1`} target="_blank" rel="noopener"><Bot size={18}/>Bot & recorder<ArrowUpRight size={14}/></a>
      <div className={styles.sidebarBottom}><span className={styles.localDot}/><div>Local workspace<small>Private worker · this computer</small></div></div>
    </aside>

    <main className={styles.main} id="overview">
      <header className={styles.header}>
        <div><div className={styles.eyebrow}>BLOCKRUSH / PUBLISHING</div><h1>Your content, in motion.</h1><p>From the next combo to the next upload. One place to follow it all.</p></div>
        <div className={styles.headerActions}><span className={`${styles.connection} ${error?styles.connectionOffline:''}`}><i/>{error?'Worker offline':'Auto-refresh · 5s'}</span><a className={styles.primary} href={`${BP}/play/?bot=1&speed=4&publisher=1`} target="_blank" rel="noopener"><Video size={16}/>Open recorder<ArrowUpRight size={15}/></a></div>
      </header>
      {error&&<div className={styles.alert} role="alert"><WifiOff size={20}/><div><strong>Waiting for the local worker</strong><p>{error} Start it with <code>npm run publisher</code>, then <button onClick={()=>void refresh()}>try again</button>.</p></div></div>}
      {notice&&<div className={styles.notice} role="status">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={16}/></button></div>}
      <section className={styles.metrics} aria-label="Publishing statistics">
        {[
          {label:'Total clips',value:total,icon:Film,detail:`${duration(data?.stats.seconds)} of recorded footage`,filter:'all'},
          {label:'Ready to publish',value:counts.ready||0,icon:Play,detail:data?.mode==='local'?'Saved locally · upload not enabled':'Prepared MP4 clips',filter:'ready'},
          {label:'Scheduled',value:counts.scheduled||0,icon:Clock3,detail:'Accepted by the scheduler',filter:'scheduled'},
          {label:'Published',value:counts.published||0,icon:CheckCircle2,detail:'Confirmed by Postiz',filter:'published'},
        ].map(card=><button key={card.label} className={styles.metric} onClick={()=>chooseFilter(card.filter)}><span className={styles.metricTop}>{card.label}<card.icon size={18}/></span><strong>{loading?'—':number(card.value)}</strong><small>{card.detail}</small></button>)}
      </section>

      <section className={styles.statusRow} aria-label="Production status">
        <div className={styles.statusCard}><span className={styles.cardIcon}><Bot size={22}/></span><div><small>GAMEPLAY BOT</small><strong>{telemetryFresh?(telemetry?.botRunning?'Playing':'Idle'):'No active session'}</strong><p>{telemetryFresh?`${telemetry?.speed}× speed · ${number(telemetry?.moves)} moves · ${number(telemetry?.score)} points`:'Open the recorder to start a session.'}</p></div></div>
        <div className={styles.statusCard}><span className={styles.cardIcon}><Radio size={22}/></span><div><small>LIVE ENCODER</small><strong>{data?.liveState==='encoding'?(data.live.lastChunkAt&&Date.now()-data.live.lastChunkAt<15000?'Sending video':'Waiting for video'):data?.liveState==='failed'?'Encoder stopped':data?.liveConfigured?'Ready to connect':'Not configured'}</strong><p>{data?.liveState==='encoding'?`${bytes(data.live.bytes)} sent · destination status is separate`:'RTMP output · configure a destination to stream'}</p></div></div>
        <div className={styles.statusCard}><span className={styles.cardIcon}><HardDrive size={22}/></span><div><small>LOCAL LIBRARY</small><strong>{bytes(data?.stats.bytes)}</strong><p>{data?.stats.held||0} held · {attention} need attention · {counts.draft||0} drafts</p></div></div>
      </section>

      <section className={styles.parallelBar} aria-label="Parallel video production"><div><strong><Video size={17}/>Parallel video production</strong><p>{data?.parallel?.active?(data.parallel.state==='recording'?`${data.parallel.count} independent sessions recording · ${Math.max(0,Math.ceil(((data.parallel.endsAt||Date.now())-Date.now())/1000))}s remaining`:data.parallel.state==='starting'?'Starting independent bot sessions…':'Finalizing recordings…'):data?.parallel?`${data.parallel.completed}/${data.parallel.count} captured · ${data.parallel.failed} failed · ${data.parallel.state}`:'Record independent games at the same time. Clips enter this queue automatically.'}</p>{data?.parallel?.error&&<p className={styles.errorText}>{data.parallel.error}</p>}</div><div className={styles.parallelControls}><label>Videos<input aria-label="Parallel video count" type="number" min={1} max={10} value={parallelCount} disabled={Boolean(data?.parallel?.active||busy)} onChange={e=>setParallelCount(Math.max(1,Math.min(10,Number(e.target.value)||1)))}/></label><label>Seconds<input aria-label="Parallel video duration" type="number" min={6} max={60} value={parallelSeconds} disabled={Boolean(data?.parallel?.active||busy)} onChange={e=>setParallelSeconds(Math.max(6,Math.min(60,Number(e.target.value)||6)))}/></label>{data?.parallel?.active?<button className={styles.button} disabled={Boolean(busy)} onClick={()=>void action('parallel/stop','stop-parallel')}><Pause size={15}/>Stop recordings</button>:<button className={styles.primary} disabled={!data?.ffmpeg||Boolean(busy)} onClick={()=>void action(`parallel/start?count=${parallelCount}&seconds=${parallelSeconds}&speed=4`,'parallel')}><Play size={15}/>Start parallel batch</button>}</div></section>

      <div className={styles.contentGrid}>
        <section className={styles.queue} id="queue">
          <div className={styles.sectionTitle}><div><h2>Publishing queue</h2><p>Your clips, from capture to confirmation.</p></div><div className={styles.queueTools}><button disabled={!data||Boolean(busy)} onClick={()=>void action(`worker/${data?.worker.paused?'resume':'pause'}`,data?.worker.paused?'resume':'pause')} className={styles.button}>{data?.worker.paused?<Play size={15}/>:<Pause size={15}/>} {data?.worker.paused?'Resume queue':'Pause queue'}</button><button aria-label="Refresh queue" title="Refresh local queue" className={styles.iconButton} onClick={()=>void refresh()}><RefreshCw size={16}/></button></div></div>
          {data?.worker.paused&&<div className={styles.inlineNote}><Pause size={14}/>Queue paused. In-progress work may finish; the next step waits.</div>}
          <div className={styles.filters}><div className={styles.tabs}>{tabs.map(([value,label])=><button key={value} className={filter===value?styles.tabActive:''} onClick={()=>chooseFilter(value)}>{label}{value==='all'&&<span>{total}</span>}</button>)}</div></div>
          <div className={styles.searchRow}><label className={styles.search}><Search size={16}/><input aria-label="Search clips" placeholder="Search by title or clip ID…" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className={styles.select}><SlidersHorizontal size={15}/><select aria-label="Clip status" value={filter} onChange={e=>chooseFilter(e.target.value)}><option value="all">All statuses</option>{Object.entries(LABELS).map(([value,label])=><option value={value} key={value}>{label}</option>)}<option value="held">On hold</option></select></label></div>
          <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>CLIP</th><th>STATUS</th><th>SCHEDULE</th><th>DESTINATIONS</th><th><span className={styles.srOnly}>Details</span></th></tr></thead><tbody>
            {data?.jobs.map(job=><tr key={job.id}><td><button className={styles.clipCell} onClick={()=>openJob(job)}><span className={styles.thumbnail}><Play size={18}/></span><span><strong>{job.title}</strong><small>{duration(job.duration)} · {bytes(job.outputBytes)} · {job.id.slice(0,8)}</small></span></button></td><td><Badge state={job.state} held={job.held}/></td><td className={styles.date}>{['scheduled','published','partial','remote_failed','sending'].includes(job.state)?date(job.scheduledAt):'—'}</td><td><span className={styles.destinationCount}>{job.receipts?.length||0} channels</span></td><td><button className={styles.iconButton} aria-label={`View ${job.title}`} onClick={()=>openJob(job)}><ChevronRight size={18}/></button></td></tr>)}
          </tbody></table></div>
          {!loading&&!data?.jobs.length&&<div className={styles.empty}><span><ListVideo size={30}/></span><h3>{total?'No matching clips':'Your next great combo starts here.'}</h3><p>{total?'Try another filter or search.':'Record a batch and every clip will appear here as it moves through the pipeline.'}</p>{total?<button className={styles.button} onClick={()=>{setSearch('');setQuery('');chooseFilter('all');}}>Clear filters</button>:<a className={styles.primary} href={`${BP}/play/?bot=1&speed=4&publisher=1`} target="_blank" rel="noopener"><Video size={16}/>Record your first batch</a>}</div>}
          {loading&&<div className={styles.empty}><LoaderCircle size={24} className={styles.spin}/><p>Connecting to your workspace…</p></div>}
          <footer className={styles.pagination}><span>{data?.matched?`${offset+1}–${Math.min(offset+limit,data.matched)} of ${data.matched}`:'0 clips'}<small>Updated {refreshed?new Date(refreshed).toLocaleTimeString():'—'}</small></span><div><button aria-label="Previous page" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-limit))}><ArrowLeft size={16}/></button><button aria-label="Next page" disabled={offset+limit>=(data?.matched||0)} onClick={()=>setOffset(offset+limit)}><ArrowRight size={16}/></button></div></footer>
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.railCard} id="connections"><div className={styles.railTitle}><h2>Connections</h2><span>{data?.channels.length||0}</span></div><p className={styles.muted}>Channels configured for this worker.</p>
            {data?.channels.length?data.channels.map(channel=><div className={styles.channel} key={channel.id}><span className={styles.channelIcon}>{channel.provider==='youtube'?<Youtube size={20}/>:<Send size={20}/>}</span><div><strong>{channel.name||channel.provider}</strong><small>{channel.visibility||channel.provider} · {channel.disabled?'Reconnect needed':channel.verified?'Verified connection':data.remote.checkedAt?'Not found in Postiz':'Not checked yet'}</small></div></div>):<div className={styles.noChannels}><Send size={23}/><strong>No channels connected</strong><p>Clips stay on this PC until you configure Postiz and your publishing destinations.</p></div>}
            <button className={styles.button} disabled={!data?.postiz||!data.channels.length||Boolean(busy)||data?.remote.syncing} onClick={()=>void action('sync','sync')}><RefreshCw size={15} className={busy==='sync'?styles.spin:''}/>Sync publication status</button>
            <small className={styles.syncTime}>Last checked: {date(data?.remote.checkedAt)}</small>{data?.remote.error&&<p className={styles.errorText}>{data.remote.error}</p>}
          </section>
          <section className={styles.railCard}><h2>Worker health</h2><div className={styles.healthRow}><span>Connection</span><b className={error?styles.errorText:styles.successText}>{error?'Offline':data?'Connected':'Connecting'}</b></div><div className={styles.healthRow}><span>FFmpeg</span><b>{data?.ffmpeg?'Available':'Unavailable'}</b></div><div className={styles.healthRow}><span>Publishing mode</span><b>{data?.mode||'—'}</b></div><div className={styles.healthRow}><span>Queue</span><b>{data?.worker.paused?'Paused':data?.worker.running?'Processing':'Idle'}</b></div><div className={styles.healthRow}><span>Slot interval</span><b>{data?`${data.intervalMinutes} min`:'—'}</b></div><div className={styles.healthRow}><span>Postiz credential</span><b>{data?.postiz?'Configured':'Missing'}</b></div></section>
          <section className={styles.helpCard}><ShieldAlert size={20}/><h3>Scheduled ≠ published</h3><p>Published counts require a confirmed Postiz result for every destination. Unknown submissions stay on hold for review.</p><a href="https://github.com/jessicacarter9955/block-rush/blob/codex/youtube-bot-publishing/docs/AUTO-PUBLISHING.md" target="_blank" rel="noopener">Setup & status guide<ExternalLink size={13}/></a></section>
        </aside>
      </div>
      <footer className={styles.pageFooter}><Gem size={14}/>BlockRush Creator Studio<span>Queue and production metrics · social views and revenue are not connected</span></footer>
    </main>

    {current&&<div className={styles.drawerBackdrop} onClick={()=>setSelected(null)}><section ref={drawer} className={styles.drawer} role="dialog" aria-modal="true" aria-label="Clip details" onClick={event=>event.stopPropagation()}><div className={styles.drawerHeader}><div><small>CLIP DETAILS</small><h2>{current.title}</h2></div><button autoFocus className={styles.iconButton} aria-label="Close clip details" onClick={()=>setSelected(null)}><X size={20}/></button></div><Badge state={current.state} held={current.held}/>
      {current.preparedAt&&<div className={styles.preview}>{preview?<video src={preview} controls playsInline/>:<button disabled={previewBusy} onClick={()=>void loadMedia(current)}>{previewBusy?<LoaderCircle className={styles.spin}/>:<Play/>}<span>{previewBusy?'Loading clip…':'Preview clip'}</span></button>}</div>}
      <div className={styles.detailsGrid}><div><small>CREATED</small>{date(current.createdAt)}</div><div><small>DURATION</small>{duration(current.duration)}</div><div><small>SCHEDULE</small>{date(current.scheduledAt)}</div><div><small>FILE SIZE</small>{bytes(current.outputBytes)}</div></div>
      {current.error&&<div className={styles.errorBox}>{current.error}</div>}
      <div className={styles.drawerActions}>{current.preparedAt&&<button className={styles.button} onClick={()=>void loadMedia(current,true)} disabled={previewBusy}><ArrowDownToLine size={16}/>Download MP4</button>}{current.state==='failed'&&!current.recordingFailed&&!current.receipts?.length&&<button className={styles.button} disabled={Boolean(busy)} onClick={()=>void action(`jobs/${current.id}/retry`,'retry')}><RefreshCw size={15}/>Retry</button>}{['captured','ready','failed'].includes(current.state)&&<button className={styles.button} disabled={Boolean(busy)} onClick={()=>void action(`jobs/${current.id}/${current.held?'release':'hold'}`,current.held?'release':'hold')}>{current.held?<Play size={15}/>:<Pause size={15}/>} {current.held?'Release clip':'Hold clip'}</button>}</div>
      <h3 className={styles.detailTitle}>Destinations</h3>{current.destinations?.length?current.destinations.map(destination=><div className={styles.remoteResult} key={destination.postId}><div><strong>{data?.channels.find(c=>c.id===destination.integration)?.name||destination.integration}</strong><small>{destination.state}</small></div>{safeUrl(destination.url)&&<a href={safeUrl(destination.url)} target="_blank" rel="noopener">View post<ExternalLink size={13}/></a>}{destination.error&&<p>{destination.error}</p>}</div>):<p className={styles.muted}>{current.receipts?.length?`${current.receipts.length} submitted destinations. Sync to confirm platform status.`:'This clip has not been submitted to a channel.'}</p>}
      <h3 className={styles.detailTitle}>Activity</h3><ol className={styles.timeline}>{[...(current.history||[])].reverse().map((event,index)=><li key={`${event.at}-${index}`}><span><Activity size={13}/></span><div><strong>{LABELS[event.state]||event.state}</strong><small>{date(event.at)}</small>{event.note&&<p>{event.note}</p>}</div></li>)}</ol><code className={styles.clipId}>{current.id}</code>
    </section></div>}
  </div>;
}
