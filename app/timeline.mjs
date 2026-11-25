// Fictional chronology only. Wall-clock message timestamps never enter arithmetic.
import {newDayState,narrativeCues,inferNarrativeDay} from './narrative-time.mjs';
export const TIMELINE_VERSION = 3;
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
const shiftDate=(date,days)=>{const value=new Date(Date.parse(date+'T00:00Z')+days*86400000).toISOString();return /^\d{4}-/.test(value)?value.slice(0,10):null;};
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
  const points=[];let current=null,dayState=newDayState();
  const active=new Set(story.messages.filter(m=>!m.superseded&&m.kind!=='thought').map(m=>m.id));
  const invalidUsers=new Set((story.generations??[]).filter(g=>['failed','interrupted','superseded'].includes(g.status)).map(g=>g.userMessageId));
  for(const message of story.messages) {
    if(message.superseded||message.kind==='thought'||message.kind==='intro'||invalidUsers.has(message.id)||(message.role==='user'&&message.storyTime===null))continue;
    // A relative origin needs no invented calendar or time of day. This lets
    // later explicit durations be related to activities in the opening exchange.
    if(!current) {
      current={segment:message.id,minute:0,date:null,time:null,label:RELATIVE_ORIGIN_LABEL,sourceId:message.id,sources:[message.id],origin:'reconstructed'};
      points.push(current);
    }
    let step=message.storyTime??reconstructTime(message);
    const suppressed=text=>(story.suppression??[]).some(s=>text.toLocaleLowerCase().includes(s.text.toLocaleLowerCase()));
    if(step&&(!step.sources.every(id=>active.has(id))||suppressed(step.label)))step=null;
    // An assistant may echo the user's already-counted standalone numeric skip.
    if(step?.origin==='reconstructed'&&step.advanceMinutes>0&&message.role==='assistant'&&dayState.lastMessage?.role==='user'&&points.at(-1)?.sourceId===dayState.lastMessage.id&&points.at(-1)?.label===step.label)step=null;
    const previous=current;
    if(step)current=advance(current,step,message.id);
    const cues=narrativeCues(message).filter(c=>!suppressed(c.text));
    if(step?.time&&previous.time&&clockMinutes(step.time)<clockMinutes(previous.time)&&!step.date&&!step.advanceMinutes&&!cues.some(c=>['nextMorning','nextDay','morning','wake'].includes(c.kind))){dayState.segment=message.id;dayState.uncertain=true;}
    let days=step?.advanceMinutes!=null?Math.floor(((previous.time?clockMinutes(previous.time):0)+step.advanceMinutes)/1440):null;
    // A known calendar rollover is stronger than a generic 24-hour estimate.
    const inferred=inferNarrativeDay(dayState,message,cues,{explicitDays:days,explicitDate:step?.date||(step?.advanceMinutes>0?current.date:null),previousDate:previous.date,explicitTime:step?current.time:null});
    dayState=inferred.state;
    if(step&&current.time)dayState.phase=Number(current.time.slice(0,2))<5?'night':Number(current.time.slice(0,2))<12?'morning':Number(current.time.slice(0,2))<18?'afternoon':Number(current.time.slice(0,2))<22?'evening':'night';
    const dayDifference=dayState.day-(previous.storyDay??1);
    if(inferred.changed&&!step?.date&&!step?.time&&!(step?.advanceMinutes>0)) {
      const date=previous.date&&dayDifference>=0&&!cues.some(c=>c.kind==='unknown')?shiftDate(previous.date,dayDifference):null;
      const unknownMinutes=dayDifference!==0||dayState.phase!==previous.dayPhase||cues.some(c=>['unknown','sleep','nap'].includes(c.kind));
      current={...previous,...(unknownMinutes?{segment:message.id,minute:0,date,time:null}:{}),label:cues.map(c=>c.text).join('; ').slice(0,200),sourceId:message.id,sources:[message.id],origin:'reconstructed'};
    }
    if(step||inferred.changed||!current.storyDay) {
      current={...current,storyDay:dayState.day,daySegment:dayState.segment,dayPhase:dayState.phase,dayConfidence:dayState.confidence,dayUncertain:dayState.uncertain};
      if(points.at(-1)?.sourceId===message.id)points.pop();points.push(current);
    }
  }
  return {version:TIMELINE_VERSION,points};
}

export function timelineContext(story) {
  const timeline=buildTimeline(story),byMessage=new Map(),order=new Map(),messageStarts=new Map();let index=0,current=null;
  const invalidUsers=new Set((story.generations??[]).filter(g=>['failed','interrupted','superseded'].includes(g.status)).map(g=>g.userMessageId));
  for(const message of story.messages){if(message.superseded||message.kind==='thought'||invalidUsers.has(message.id)||(message.role==='user'&&message.storyTime===null))continue;messageStarts.set(message.id,current??{storyDay:1});if(timeline.points[index]?.sourceId===message.id)current=timeline.points[index++];order.set(message.id,order.size);byMessage.set(message.id,current);}
  const latest=timeline.points.at(-1)??null;
  return {current:latest, byMessage, order, messageStarts, invalidUsers};
}

export function evidenceTimes(entries, clock) {
  return entries.slice(0,64).map(entry=>{
    // Earliest retained evidence is not necessarily the actual event onset.
    const source=(entry.originSources??entry.sources).filter(id=>clock.byMessage.has(id)).sort((a,b)=>clock.order.get(a)-clock.order.get(b))[0];
    const first=clock.byMessage.get(source)??null;
    const elapsed=first&&clock.current&&first.segment===clock.current.segment?clock.current.minute-first.minute:null;
    const days=first?.date&&clock.current?.date?(stamp(clock.current.date,'00:00')-stamp(first.date,'00:00'))/1440:null;
    const narrativeDays=first&&clock.current&&first.daySegment===clock.current.daySegment?clock.current.storyDay-first.storyDay:null;
    return {recordId:entry.id,sourceId:source??null,firstEvidencedAt:first,minutesSinceEvidence:elapsed,calendarDaysSinceEvidence:days!==null&&days>=0?days:null,
      narrativeDayChangesSinceEvidence:narrativeDays,dayCountUncertain:!first||!clock.current||first.daySegment!==clock.current.daySegment||clock.messageStarts.get(source)?.storyDay!==first.storyDay};
  });
}

export function validateTimelineContext(value, ids) {
  const check=condition=>{if(!condition)throw Object.assign(new Error('Invalid timeline context.'),{code:'invalid'});};
  const shape=(v,keys,optional=[])=>check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k)||optional.includes(k))&&keys.every(k=>Object.hasOwn(v,k)));
  const point=p=>{if(p===null)return;shape(p,['segment','minute','date','time','label','sourceId','sources','origin'],['storyDay','daySegment','dayPhase','dayConfidence','dayUncertain']);check(ids.has(p.segment)&&ids.has(p.sourceId)&&Number.isFinite(p.minute)&&p.minute>=0);validateTimeStep({advanceMinutes:0,date:p.date,time:p.time,label:p.label,sources:p.sources,origin:p.origin},ids,true);if(p.storyDay!==undefined)check(Number.isSafeInteger(p.storyDay)&&p.storyDay>=1&&ids.has(p.daySegment)&&['unknown','morning','afternoon','evening','night'].includes(p.dayPhase)&&['inferred','dated','explicit'].includes(p.dayConfidence)&&typeof p.dayUncertain==='boolean');};
  shape(value,['current','evidence','evidenceLimit','coverage'],['historicalEvidence','activityStartSourceId']);point(value.current);check(['explicit-checkpoints-only','narrative-day-inference'].includes(value.coverage)&&value.evidenceLimit===64&&Array.isArray(value.evidence)&&value.evidence.length<=64);
  for(const e of value.evidence){shape(e,['recordId','sourceId','firstEvidencedAt','minutesSinceEvidence','calendarDaysSinceEvidence'],['narrativeDayChangesSinceEvidence','dayCountUncertain']);check(typeof e.recordId==='string'&&e.recordId.length<=100&&(e.sourceId===null||ids.has(e.sourceId)));point(e.firstEvidencedAt);for(const k of ['minutesSinceEvidence','calendarDaysSinceEvidence','narrativeDayChangesSinceEvidence'])if(e[k]!==undefined)check(e[k]===null||(Number.isFinite(e[k])&&e[k]>=0));if(e.dayCountUncertain!==undefined)check(typeof e.dayCountUncertain==='boolean');}
  if(value.historicalEvidence!==undefined){check(Array.isArray(value.historicalEvidence)&&value.historicalEvidence.length<=6);for(const e of value.historicalEvidence){shape(e,['sourceId','text','startStoryDay','endStoryDay','dayChangesSinceEvidence','uncertain'],['activityRole']);check(ids.has(e.sourceId)&&typeof e.text==='string'&&e.text.length<=1800&&typeof e.uncertain==='boolean');if(e.activityRole!==undefined)check(['start','preparation','phase','plan','progress'].includes(e.activityRole));for(const k of ['startStoryDay','endStoryDay','dayChangesSinceEvidence'])check(e[k]===null||(Number.isSafeInteger(e[k])&&e[k]>=0));}}
  if(value.activityStartSourceId!==undefined)check(value.activityStartSourceId===null||(ids.has(value.activityStartSourceId)&&(value.historicalEvidence??[]).some(e=>e.sourceId===value.activityStartSourceId)));
}
