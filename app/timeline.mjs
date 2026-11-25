// Fictional chronology only. Wall-clock message timestamps never enter arithmetic.
export const TIMELINE_VERSION = 1;
export const RELATIVE_ORIGIN_LABEL = 'Relative story origin; calendar and clock unknown';
export const timeStepSchema = { type: 'object', additionalProperties: false,
  properties: {
    advanceMinutes: {anyOf:[{type:'integer',minimum:0,maximum:52560000},{type:'null'}]},
    date: {anyOf:[{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},{type:'null'}]},
    time: {anyOf:[{type:'string',pattern:'^([01]\\d|2[0-3]):[0-5]\\d$'},{type:'null'}]},
    label: {type:'string',minLength:1,maxLength:200},
    sources: {type:'array',minItems:1,maxItems:16,items:{type:'string',minLength:1,maxLength:100}},
  }, required:['advanceMinutes','date','time','label','sources'] };

const validDate = date => typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date+'T00:00:00Z')) && new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
export function validateTimeStep(value, sourceIds, stored=false) {
  const keys=[...timeStepSchema.required,...(stored?['origin']:[])];
  const fail=()=>{throw Object.assign(new Error('Invalid fictional time checkpoint.'),{code:'invalid'});};
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!keys.includes(k)) || keys.some(k=>!Object.hasOwn(value,k)))fail();
  if(value.advanceMinutes!==null && (!Number.isSafeInteger(value.advanceMinutes)||value.advanceMinutes<0||value.advanceMinutes>52560000))fail();
  if(value.date!==null&&!validDate(value.date))fail();
  if(value.time!==null&&(typeof value.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)))fail();
  if(typeof value.label!=='string'||!value.label.trim()||value.label.length>200)fail();
  const allowed=new Set(sourceIds);
  if(!Array.isArray(value.sources)||value.sources.length<1||value.sources.length>16||value.sources.some(s=>!allowed.has(s)))fail();
  if(stored&&!['model','reconstructed'].includes(value.origin))fail();
  return structuredClone(value);
}

// Deliberately narrow: only explicit scene markers / standalone stage directions.
// Arbitrary dates in dialogue, promises, memories and hypotheticals are not clocks.
export function reconstructTime(message) {
  if(message.kind==='thought'||message.superseded)return null;
  const line=message.text.trim();
  const marker=line.match(/^(?:\*\s*)?(?:story time|scene time|story date|scene date|erzählzeit|szenenzeit|szenendatum)\s*:\s*([^\n*]{1,200})(?:\s*\*)?(?:\n|$)/iu);
  const numbers={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,ein:1,eine:1,einen:1,zwei:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10};
  const direction=line.match(/^\*?\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|ein|eine|einen|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s+(minutes?|hours?|days?|weeks?|minuten?|stunden?|tage?|wochen?)\s+(?:later|später)[.!]?\s*\*?(?:\n|$)/iu);
  if(direction){const factor=/^(hour|stund)/iu.test(direction[2])?60:/^(day|tag)/iu.test(direction[2])?1440:/^(week|woch)/iu.test(direction[2])?10080:1;const delta=(numbers[direction[1].toLocaleLowerCase()]??Number(direction[1]))*factor;if(!Number.isSafeInteger(delta)||delta>52560000)return null;return {advanceMinutes:delta,date:null,time:null,label:direction[0].trim().slice(0,200),sources:[message.id],origin:'reconstructed'};}
  const vague=line.match(/^\*?\s*(the next morning|the following day|some time later|am nächsten morgen|am folgenden tag|einige zeit später)[.!]?\s*\*?(?:\n|$)/iu);
  if(vague)return {advanceMinutes:null,date:null,time:null,label:vague[1],sources:[message.id],origin:'reconstructed'};
  if(!marker)return null;
  const label=marker[1].trim();
  const date=label.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]??null;
  const time=label.match(/\b((?:[01]\d|2[0-3]):[0-5]\d)\b/)?.[1]??null;
  if(date&&!validDate(date))return null;
  return {advanceMinutes:null,date,time,label,sources:[message.id],origin:'reconstructed'};
}

const clockMinutes=time=>Number(time.slice(0,2))*60+Number(time.slice(3));
const stamp=(date,time)=>Date.parse(date+'T'+time+':00Z')/60000;
function advance(previous, step, id) {
  let delta=step.advanceMinutes;
  if(previous&&step.date&&step.time&&previous.date&&previous.time) {
    const difference=stamp(step.date,step.time)-stamp(previous.date,previous.time);
    delta=difference>=0?difference:null;
  } else if(previous&&step.time&&previous.time&&(!step.date||step.date===previous.date)) {
    const difference=clockMinutes(step.time)-clockMinutes(previous.time);
    if(difference>=0)delta=difference;
    else if(!delta)delta=null; // Do not invent a midnight rollover.
  } else if(previous?.date&&step.date&&step.date!==previous.date&&!step.time&&!delta) {
    delta=null; // A calendar day alone does not establish an exact duration.
  }
  const continuous=previous&&delta!==null;
  let date=step.date??(continuous?previous.date:null), time=step.time??(continuous?previous.time:null);
  if(continuous&&delta && !step.date&&!step.time) {
    if(previous.date&&previous.time){const s=new Date((stamp(previous.date,previous.time)+delta)*60000).toISOString();date=/^\d{4}-/.test(s)?s.slice(0,10):null;time=s.split('T')[1].slice(0,5);}
    else if(previous.time){const minutes=clockMinutes(previous.time)+delta;time=String(Math.floor(minutes/60)%24).padStart(2,'0')+':'+String(Math.floor(minutes%60)).padStart(2,'0');}
    else if(previous.date)date=null; // Unknown time of day: do not invent calendar rollover.
  }
  return {segment:continuous?previous.segment:id,minute:continuous?previous.minute+delta:0,date,time,label:step.label,sourceId:id,sources:step.sources,origin:step.origin};
}

export function buildTimeline(story) {
  const points=[];let current=null;
  const active=new Set(story.messages.filter(m=>!m.superseded&&m.kind!=='thought').map(m=>m.id));
  const invalidUsers=new Set((story.generations??[]).filter(g=>['failed','interrupted','superseded'].includes(g.status)).map(g=>g.userMessageId));
  for(const message of story.messages) {
    if(message.superseded||message.kind==='thought'||message.kind==='intro'||invalidUsers.has(message.id))continue;
    // A relative origin needs no invented calendar or time of day. This lets
    // later explicit durations be related to activities in the opening exchange.
    if(!current) {
      current={segment:message.id,minute:0,date:null,time:null,label:RELATIVE_ORIGIN_LABEL,sourceId:message.id,sources:[message.id],origin:'reconstructed'};
      points.push(current);
    }
    const step=Object.hasOwn(message,'storyTime')?message.storyTime:reconstructTime(message);
    if(step&&step.sources.every(id=>active.has(id))&&!(story.suppression??[]).some(s=>step.label.toLocaleLowerCase().includes(s.text.toLocaleLowerCase()))){current=advance(current,step,message.id);if(points.at(-1)?.sourceId===message.id)points.pop();points.push(current);}
  }
  return {version:TIMELINE_VERSION,points};
}

export function timelineContext(story) {
  const timeline=buildTimeline(story),byMessage=new Map(),order=new Map();let index=0,current=null;
  for(const message of story.messages){if(message.superseded||message.kind==='thought')continue;if(timeline.points[index]?.sourceId===message.id)current=timeline.points[index++];order.set(message.id,order.size);byMessage.set(message.id,current);}
  const latest=timeline.points.at(-1)??null;
  return {current:latest, byMessage, order};
}

export function evidenceTimes(entries, clock) {
  return entries.slice(0,64).map(entry=>{
    // Earliest retained evidence is not necessarily the actual event onset.
    const source=(entry.originSources??entry.sources).filter(id=>clock.byMessage.has(id)).sort((a,b)=>clock.order.get(a)-clock.order.get(b))[0];
    const first=clock.byMessage.get(source)??null;
    const elapsed=first&&clock.current&&first.segment===clock.current.segment?clock.current.minute-first.minute:null;
    const days=first?.date&&clock.current?.date?(stamp(clock.current.date,'00:00')-stamp(first.date,'00:00'))/1440:null;
    return {recordId:entry.id,sourceId:source??null,firstEvidencedAt:first,minutesSinceEvidence:elapsed,calendarDaysSinceEvidence:days!==null&&days>=0?days:null};
  });
}

export function validateTimelineContext(value, ids) {
  const check=condition=>{if(!condition)throw Object.assign(new Error('Invalid timeline context.'),{code:'invalid'});};
  const shape=(v,keys)=>check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));
  const point=p=>{if(p===null)return;shape(p,['segment','minute','date','time','label','sourceId','sources','origin']);check(ids.has(p.segment)&&ids.has(p.sourceId)&&Number.isFinite(p.minute)&&p.minute>=0);validateTimeStep({advanceMinutes:0,date:p.date,time:p.time,label:p.label,sources:p.sources,origin:p.origin},ids,true);};
  shape(value,['current','evidence','evidenceLimit','coverage']);point(value.current);check(value.coverage==='explicit-checkpoints-only'&&value.evidenceLimit===64&&Array.isArray(value.evidence)&&value.evidence.length<=64);
  for(const e of value.evidence){shape(e,['recordId','sourceId','firstEvidencedAt','minutesSinceEvidence','calendarDaysSinceEvidence']);check(typeof e.recordId==='string'&&e.recordId.length<=100&&(e.sourceId===null||ids.has(e.sourceId)));point(e.firstEvidencedAt);for(const k of ['minutesSinceEvidence','calendarDaysSinceEvidence'])check(e[k]===null||(Number.isFinite(e[k])&&e[k]>=0));}
}
