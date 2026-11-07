'use client';

import { useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ExternalLink, Gamepad2, Grid2X2, Home, Monitor, MonitorPlay, Smartphone, Square } from 'lucide-react';
import { BP } from '@/lib/bp';
import formats from '@/lib/social-formats.json';
import styles from './resolution-inspector.module.css';

const displays = formats.filter(item => item.group === 'display');
type Scene = 'game' | 'home';

const names:Record<string,string> = {
  'gameplay-portrait-fhd':'Portrait Full HD',
  'gameplay-portrait-4k':'Portrait 4K',
  'gameplay-landscape-fhd':'Landscape Full HD',
  'gameplay-landscape-4k':'Landscape 4K',
  'gameplay-ultrawide':'Ultrawide',
  'gameplay-square':'Square',
};

const deviceIcon = (id:string) => {
  if (id.includes('portrait')) return Smartphone;
  if (id.includes('square')) return Square;
  if (id.includes('ultrawide')) return Monitor;
  return MonitorPlay;
};

export function ResolutionInspector() {
  const [formatId,setFormatId] = useState('gameplay-landscape-fhd');
  const [scene,setScene] = useState<Scene>('game');
  const [showGuides,setShowGuides] = useState(false);
  const [zoom,setZoom] = useState(100);
  const selected = displays.find(item => item.id === formatId)!;
  const imageUrl = `${BP}/blockrush-formats/${scene}-${selected.id}.webp`;

  return <main className={styles.studio}>
    <nav className={styles.topnav} aria-label="Resolution studio navigation">
      <a className={styles.brand} href={`${BP}/publisher/`}><span><Grid2X2 size={23}/></span>BlockRush <small>Resolution Studio</small></a>
      <a href={`${BP}/publisher/`}><ArrowLeft size={16}/>Publisher queue</a>
    </nav>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>ASSETS / HOME + GAMEPLAY / SIX DEVICES</p><h1>One game. Every screen.</h1>
        <p>Compare the actual BlockRush sprite composition, frame and UI at exact target dimensions. All blocks and icons come from the original asset set.</p></div>
      <a className={styles.recorder} href={`${BP}/play/?bot=1&publisher=1`}><Gamepad2 size={18}/>Open gameplay <ExternalLink size={14}/></a>
    </header>

    <section className={styles.workspace} aria-label="Artwork preview and output settings">
      <aside className={styles.selectors}>
        <h2>Display target</h2><p>Choose one of the six verified resolutions.</p>
        <div className={styles.options}>
          {displays.map(item=>{
            const Icon=deviceIcon(item.id);
            return <button key={item.id} aria-pressed={formatId===item.id} onClick={()=>setFormatId(item.id)}><Icon size={19}/><span><strong>{names[item.id]}</strong><small>{item.width} × {item.height} · {item.ratio}</small></span></button>;
          })}
        </div>
        <div className={styles.separator}/>
        <h2>Screen</h2>
        <div className={styles.toggle}><button aria-pressed={scene==='game'} onClick={()=>setScene('game')}><Gamepad2 size={16}/>Gameplay</button><button aria-pressed={scene==='home'} onClick={()=>setScene('home')}><Home size={16}/>Home</button></div>
        <label className={styles.guideLabel}><input type="checkbox" checked={showGuides} onChange={event=>setShowGuides(event.target.checked)}/>Show composition guide</label>
        <label className={styles.zoomLabel}>Preview zoom <span>{zoom}%</span><input type="range" min="50" max="150" step="10" value={zoom} onChange={event=>setZoom(Number(event.target.value))}/></label>
        <a className={styles.download} href={imageUrl} download={`${scene}-${selected.id}.webp`}><ArrowDownToLine size={17}/>Download exact-size image</a>
      </aside>
      <div className={styles.stage}>
        <div className={styles.stageHeader}><span className={styles.stageStatus}><i/>Source-faithful image</span><span>{selected.width} × {selected.height} · {selected.ratio}</span></div>
        <div className={styles.stageCanvas}>
          <div className={styles.previewFrame} style={{aspectRatio:`${selected.width}/${selected.height}`,width:`min(100%, ${Math.round(850 * zoom / 100)}px, ${Math.round(62 * (selected.width / selected.height) * zoom / 100)}vh)`}}>
            <img src={imageUrl} alt={`BlockRush ${scene === 'game' ? 'gameplay' : 'home'} at ${selected.width}×${selected.height}`}/>
            {showGuides&&<div className={styles.guides} aria-hidden="true"><i/><b/><small>{selected.width} × {selected.height}</small></div>}
          </div>
        </div>
        <div className={styles.stageFooter}><span>{names[selected.id]} · {scene === 'game' ? 'Gameplay (illustrative board state)' : 'Home screen'}</span><a href={imageUrl} target="_blank" rel="noopener noreferrer">Full-size view <ExternalLink size={13}/></a></div>
      </div>
    </section>
    <section className={styles.caution}><h2>Artwork previews vs. actual recordings</h2><p>These are precise-size static references with original sprites, not recordings of live gameplay. In Creator Studio you can produce an MP4 in any of these six canvas sizes or queue all six from a recorded clip. Until native widescreen capture is implemented, video exports keep the portrait board visible with margins instead of cropping it.</p></section>
  </main>;
}
