export function sliderToSpeed(value: number): number {
  return Math.round(.25 * 2 ** (Math.max(0,Math.min(100,Number.isFinite(value)?value:0))/100*6)*100)/100;
}
export function speedToSlider(speed:number):number {
  return Math.round(Math.log2(Math.max(.25,Math.min(16,Number.isFinite(speed)?speed:1))/.25)/6*100);
}
export function captureRect(rect:{left:number;top:number;width:number;height:number},viewport:{width:number;height:number},frame:{width:number;height:number}) {
  if(viewport.width<=0 || viewport.height<=0 || frame.width<=0 || frame.height<=0 || rect.width<=0 || rect.height<=0) throw new Error('Dimensioni di acquisizione non valide.');
  if(rect.left<-.5 || rect.top<-.5 || rect.left+rect.width>viewport.width+.5 || rect.top+rect.height>viewport.height+.5) throw new Error('Mantieni tutta l’area di gioco visibile durante la registrazione.');
  const kx=frame.width/viewport.width, ky=frame.height/viewport.height;
  return {x:Math.max(0,rect.left)*kx,y:Math.max(0,rect.top)*ky,width:rect.width*kx,height:rect.height*ky};
}
export async function createGameRecorder({element,audio,onTime,onComplete,onError}:{element:HTMLElement;audio:boolean;onTime:(s:number)=>void;onComplete:(blob:Blob,duration:number)=>void;onError:(message:string)=>void}):Promise<()=>void> {
  if(!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder==='undefined') throw new Error('Usa Chrome o Edge su desktop per registrare.');
  let display:MediaStream|undefined,mixed:MediaStream|undefined,rec:MediaRecorder|undefined;
  let video:HTMLVideoElement|undefined,raf=0,frameCallback=0,timer=0,timeout=0,closed=false;
  const cleanup=()=>{closed=true;clearInterval(timer);clearTimeout(timeout);cancelAnimationFrame(raf);if(video){video.cancelVideoFrameCallback?.(frameCallback);video.pause();video.srcObject=null;}display?.getTracks().forEach(t=>t.stop());mixed?.getTracks().forEach(t=>t.stop());};
  const stop=()=>{if(rec && rec.state!=='inactive') rec.stop();else cleanup();};
  try {
    display=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',systemAudio:'exclude'} as DisplayMediaStreamOptions);
    const track=display.getVideoTracks()[0];
    if(!track) throw new Error('Nessuna traccia video disponibile.');
    const surface=track.getSettings().displaySurface;
    if(surface && surface!=='browser') throw new Error('Scegli la scheda di Block Rush, non lo schermo o una finestra: il ritaglio richiede la scheda.');
    video=document.createElement('video');video.srcObject=new MediaStream([track]);video.muted=true;video.playsInline=true;
    await Promise.race([video.play(),new Promise<never>((_,reject)=>{timeout=window.setTimeout(()=>reject(new Error('La condivisione non ha avviato il video. Riprova.')),10000);})]);clearTimeout(timeout);
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
    const ctx=canvas.getContext('2d');if(!ctx) throw new Error('Canvas non disponibile.');
    const draw=()=>{const r=captureRect(element.getBoundingClientRect(),{width:innerWidth,height:innerHeight},{width:video!.videoWidth,height:video!.videoHeight});ctx.drawImage(video!,r.x,r.y,r.width,r.height,0,0,1080,1920);};
    draw();mixed=canvas.captureStream(30);for(const t of display.getAudioTracks()) mixed.addTrack(t);
    const mime=['video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
    rec=new MediaRecorder(mixed,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:12000000,audioBitsPerSecond:128000});
    const chunks:Blob[]=[];let failed=false;const start=performance.now();
    rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    rec.onerror=()=>{failed=true;onError('Registrazione interrotta dal browser.');stop();};
    rec.onstop=()=>{const type=rec!.mimeType||mime||'video/webm';const duration=(performance.now()-start)/1000;cleanup();if(!failed && chunks.length)onComplete(new Blob(chunks,{type}),duration);else if(!failed)onError('Il video è vuoto. Riprova dopo aver scelto la scheda corretta.');};
    const pump=()=>{if(closed)return;try{draw();if(typeof video!.requestVideoFrameCallback==='function')frameCallback=video!.requestVideoFrameCallback(pump);else raf=requestAnimationFrame(pump);}catch(e){failed=true;onError(e instanceof Error?e.message:String(e));stop();}};
    track.addEventListener('ended',stop,{once:true});rec.start(500);pump();timer=window.setInterval(()=>onTime((performance.now()-start)/1000),250);
    return stop;
  }catch(error){cleanup();throw error;}
}
