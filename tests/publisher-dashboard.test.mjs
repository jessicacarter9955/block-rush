import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createPublisher } from '../publisher/server.mjs';

test('dashboard API paginates independently of global stats and authenticates every control',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'blockrush-dashboard-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {server,queue,origin}=await createPublisher({directory,root:directory,port:18767,config:{mode:'local'},convert:async args=>writeFile(args.at(-1),'video')});
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  await queue.setPaused(true);
  for(let index=0;index<8;index++){
    await queue.add({id:randomUUID(),source:`${index}.webm`,title:`Clip ${index}`,duration:30});
    if(index<3)queue.transition(queue.jobs[index],'ready');
    if(index===7)queue.transition(queue.jobs[index],'unknown');
  }
  const status=await(await fetch(`${origin}/api/publisher/status?limit=2&filter=ready`)).json();
  assert.equal(status.jobs.length,2);assert.equal(status.matched,3);assert.equal(status.stats.total,8);assert.equal(status.stats.counts.ready,3);
  assert.equal(status.worker.paused,true);assert.equal(status.stats.seconds,240);
  const job=queue.jobs[0];
  const denied=await fetch(`${origin}/api/publisher/jobs/${job.id}/hold`,{method:'POST'});
  assert.equal(denied.status,401);assert.equal(job.held,undefined);
  const headers={Authorization:`Bearer ${status.token}`};
  const held=await fetch(`${origin}/api/publisher/jobs/${job.id}/hold`,{method:'POST',headers});
  assert.equal(held.status,200);assert.equal(job.held,true);
  const heldList=await(await fetch(`${origin}/api/publisher/status?filter=held`)).json();assert.equal(heldList.jobs.length,1);assert.equal(heldList.stats.held,1);
  const released=await fetch(`${origin}/api/publisher/jobs/${job.id}/release`,{method:'POST',headers});assert.equal(released.status,200);assert.equal(job.held,false);
  const unknown=queue.jobs[7];
  const retry=await fetch(`${origin}/api/publisher/jobs/${unknown.id}/retry`,{method:'POST',headers});assert.equal(retry.status,409);assert.equal(unknown.state,'unknown');
  const telemetry=await fetch(`${origin}/api/publisher/telemetry`,{method:'POST',headers,body:JSON.stringify({botRunning:true,speed:4,score:500,moves:20,lines:3,capture:'batch',elapsed:10,clips:2,secret:'must-not-appear'})});
  assert.equal(telemetry.status,200);
  const current=await(await fetch(`${origin}/api/publisher/status?q=Clip%207`)).json();assert.equal(current.jobs.length,1);assert.equal(current.telemetry.botRunning,true);assert.equal(current.telemetry.secret,undefined);
  const sync=await fetch(`${origin}/api/publisher/sync`,{method:'POST',headers});assert.equal(sync.status,409);
});
