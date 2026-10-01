'use client';
import {useEffect,useState} from 'react';
import {Lightbulb,RotateCcw} from 'lucide-react';
import {Action,Label,Panel,Round} from './RushUI';
import {pos} from './Kit';
import {BlockTile} from '@/components/blocks/BlockTile';
import {applySolution,placedCells,type Board,type SolutionMove} from '@/lib/game';
import {blockImgTile,type SkinState} from '@/lib/skin';

export interface ReplayProof {board:Board;solution:SolutionMove[]}
export function HintDialog({hasSolution,busy,message,watch,close,demo,replay}:{hasSolution:boolean;busy:boolean;message:string;watch:()=>void;close:()=>void;demo?:()=>void;replay:()=>void}) {
 return <div role="dialog" aria-modal="true" aria-label="Suggerimento" style={{position:'absolute',inset:0,zIndex:100}}><Panel y={980} h={1040}><Round kind="close" x={902} y={550} size={88} onClick={close}/><Label text="UN SUGGERIMENTO?" y={700} size={54} title/><Label text={hasSolution?'Guarda un annuncio per scoprire':'La sequenza non è più disponibile.'} y={850} size={34}/><Label text={hasSolution?'il prossimo pezzo e dove posizionarlo.':'Rivedi le mosse prima dell’errore.'} y={910} size={32}/><Action label={hasSolution?(busy?'CARICAMENTO…':'GUARDA ANNUNCIO'):'VEDI REPLAY'} y={1120} h={130} primary font={40} onClick={hasSolution?watch:replay}/>{message && <Label text={message} y={1250} size={26} color="#ffd05a"/>}{demo && hasSolution && !busy && <Action label="PROVA SUGGERIMENTO · DEMO" icon={Lightbulb} y={1390} w={600} h={90} font={25} onClick={demo}/>}</Panel></div>;
}

/** Independent simulation: closing a replay leaves the real run untouched. */
export function SolutionReplay({proof,skin,close}:{proof:ReplayProof;skin:SkinState;close:()=>void}) {
 const [step,setStep]=useState(0);
 useEffect(()=>{if(step>=proof.solution.length)return;const timer=setTimeout(()=>setStep(s=>s+1),3000);return()=>clearTimeout(timer);},[step,proof]);
 let board=[...proof.board];
 for(let i=0;i<step;i++)board=applySolution(board,proof.solution[i]);
 const active=proof.solution[step];
 const targets=new Set(active?placedCells(active.piece,active.r,active.c).map(([r,c])=>r*8+c):[]);
 return <div role="dialog" aria-modal="true" aria-label="Replay soluzione" style={{position:'absolute',inset:0,zIndex:110}}><Panel y={960} h={1400}><Round kind="close" x={902} y={350} size={88} onClick={close}/><Label text="UNA SOLUZIONE POSSIBILE" y={415} size={44} title/><div style={pos(540,922,704,704)}>{board.map((v,i)=><div key={i} style={{position:'absolute',left:(i%8)*88,top:Math.floor(i/8)*88,width:88,height:88,background:'#14295c',border:'2px solid #0a173d',borderRadius:9}}>{v!==null && <BlockTile colorIdx={v} color={skin.blocks.colors[v]} style={skin.blocks.style} size={88} radius={skin.blocks.radius} gap={skin.blocks.gap} border={skin.blocks.border} imgSrc={blockImgTile(skin,v)}/>} {targets.has(i) && active && <div className="replay-target" style={{position:'absolute',inset:0,outline:'3px solid #aafff0'}}><BlockTile colorIdx={active.piece.color} color={skin.blocks.colors[active.piece.color]} style={skin.blocks.style} size={88} radius={skin.blocks.radius} gap={skin.blocks.gap} border={skin.blocks.border} imgSrc={blockImgTile(skin,active.piece.color)}/></div>}</div>)}</div><Label text={active?`Mossa ${step+1}/${proof.solution.length} · pezzo ${active.slot+1}`:'Tutti i pezzi trovavano spazio.'} y={1360} size={34} color="#aafff0"/><Label text="Replay dimostrativo · punteggio invariato" y={1430} size={27} color="#b7cdf4"/><Action label="RIPETI REPLAY" icon={RotateCcw} y={1580} w={640} h={100} font={34} onClick={()=>setStep(0)}/></Panel></div>;
}
