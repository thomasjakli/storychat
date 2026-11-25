// Source-grounded narrative cues, not a wall-clock or a general language parser.
// The ordered state machine deliberately keeps day inference separate from minutes.
const normalize = value => value.normalize('NFKC').toLocaleLowerCase();
const nonCurrent = /\b(?:remember(?:s|ed|ing)?|recall(?:s|ed)?|dream(?:s|ed|ing)?|imagin(?:e|es|ed|ing)|would|could|might|will|think(?:s|ing)?|thought|yesterday|used to|last (?:night|week)|earlier that (?:day|morning)|flashback|rückblick|erinner\p{L}*|träum\p{L}*|vorstell\p{L}*|würde\p{L}*|könnte\p{L}*|denk\p{L}*|überleg\p{L}*|gestern|damals|letzte[nrsm]? (?:nacht|woche))\b/iu;
const negated = /\b(?:not|never|didn't|doesn't|don't|isn't|is not|nicht|nie|kein\p{L}*)\b/iu;
const planned = /\b(?:tomorrow|plan\p{L}*|want\p{L}*|intend\p{L}*|hope\p{L}*|wish\p{L}*|if|wenn|möchte\p{L}*|wollen|will ich|will er|will sie|willst|soll\p{L}*|hoff\p{L}*)\b/iu;
const patterns = [
  ['daySkip', /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ein|eine|einen|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s+(days?|weeks?|nights?|tage?|wochen?|nächte?)\s+(?:later|später)\b/giu],
  ['unknown', /\b(?:some time later|an unspecified time later|einige zeit später|irgendwann später)\b/giu],
  ['nextMorning', /\b(?:the (?:next|following) morning|next morning|the morning after|(?:am|an dem) (?:nächsten|folgenden|darauffolgenden) morgen|(?:der|ein) (?:nächste|folgende|neue) morgen|nächster morgen|morgens darauf|am morgen danach)\b/giu],
  ['nextDay', /\b(?:the (?:next|following) day|next day|the day after|(?:am|an dem) (?:nächsten|folgenden|darauffolgenden) tag|(?:der|ein) (?:nächste|folgende|neue) tag|(?:am )?tag darauf|einen tag später|a day later)\b/giu],
  ['morning', /\b(?:it (?:is|was) (?:now |already )?morning|morning (?:light|sun|sunlight)|dawn (?:breaks|broke)|es (?:ist|war|wird) (?:nun |schon |bereits )?morgen|morgenlicht|morgensonne|(?:im|beim) morgengrauen|(?:der|ein) morgen (?:bricht|brach|dämmert))\b/giu],
  ['evening', /\b(?:it (?:is|was|gets|grew) (?:now |already |late )?evening|evening (?:light|sun)|the sun (?:sets|set)|es (?:ist|war|wird|wurde) (?:nun |schon |bereits |später )?abend|abendlicht|abendsonne|die sonne (?:geht unter|ging unter)|(?:am|gegen) (?:späten )?abend)\b/giu],
  ['afternoon', /\b(?:in the afternoon|it (?:is|was) (?:now )?afternoon|(?:am|gegen) nachmittag|es (?:ist|war|wird) (?:nun )?nachmittag)\b/giu],
  ['night', /\b(?:it (?:is|was|gets|grew) (?:now |already |late )?night|es (?:ist|war|wird|wurde) (?:nun |schon |bereits |späte )?nacht|(?:mitten|in der mitte) (?:in der|der) nacht|middle of the night)\b/giu],
  ['nap', /\b(?:nap|naps|napping|napped|nickerchen|mittagsschlaf)\b/giu],
  ['sleep', /\b(?:fall(?:s)? asleep|fell asleep|go(?:es)? to (?:sleep|bed)|went to (?:sleep|bed)|sleep(?:s)? through the night|(?:schlaf(?:e|en|t|est|et)?|schläf(?:t|st)|schlief(?:en|st|t)?) (?:\p{L}+ ){0,3}ein|eingeschlafen|(?:geh\p{L}*|ging\p{L}*|leg\p{L}*) (?:\p{L}+ ){0,3}(?:ins bett|schlafen)|(?:schlaf(?:e|en|t|est|et)?|schlief(?:en|st|t)?) (?:\p{L}+ ){0,3}(?:durch|bis zum morgen))\b/giu],
  ['wake', /\b(?:wak(?:e(?:s)?|ing) up|woke up|aufwach(?:e|en|t|st|est|et)?|aufgewacht|(?:werd\p{L}*|wurd\p{L}*) (?:\p{L}+ ){0,3}wach|awaken(?:s|ed)?|wach(?:e|en|t|st|est|et)? (?:\p{L}+ ){0,3}auf|erwach(?:e|en|t|st|est|et)?|erwacht(?:e|en|est|et)?)\b/giu],
  ['eyes', /\b(?:open(?:s|ed)? (?:my|his|her|our|their) eyes|öffne\p{L}* (?:\p{L}+ ){0,3}augen)\b/giu],
  ['morning', /\b(?:morgens|frühmorgens|früh am morgen|in the morning|at daybreak|bei tagesanbruch|(?:wir|ich|sie|er) frühstück\p{L}*|(?:zum|beim|nach dem) frühstück)\b/giu],
  ['evening', /\b(?:spät(?:er|en)? (?:am )?abend|(?:zum|beim|nach dem) abendessen|(?:wir|ich|sie|er) ess\p{L}* (?:\p{L}+ ){0,3}(?:zu abend|abendessen)|(?:eat|eats|eating|ate) dinner|(?:for|at|after) dinner|(?:das )?letzte sonnenlicht|it's (?:now |already )?evening|sunset)\b/giu],
  ['afternoon', /\b(?:gegen mittag|(?:am|im) späten nachmittag|(?:zum|beim|nach dem) mittagessen|(?:eat|eats|eating|ate) lunch|(?:at|after) lunch|it's (?:now )?afternoon)\b/giu],
  ['wake', /\b(?:wach geworden|wach(?:e|en|t|st|est|et)? (?:\p{L}+ ){0,8}auf|have woken up|has woken up|waking|awoke)\b/giu],
  ['sleep', /\b(?:schlaf(?:e|en|t|est|et)?|schläf(?:t|st)|schlief(?:en|st|t)?) (?:\p{L}+ ){0,8}ein\b/giu],
  ['shortSleep', /\b(?:nach (?:anderthalb|eineinhalb|ein einhalb|einer halben|einer|zwei|drei|[123](?:[.,]5)?) stunden?|nach (?:dreißig|sechzig|neunzig|30|60|90) minuten|after (?:(?:an?|one|two|three|[123](?:[.,]5)?) hours?(?: and a half)?|half an hour|(?:30|60|90) minutes))\b/giu],
];

// Preserve offsets and asterisks; remove only clear quotation spans. Apostrophes
// in contractions and unmatched quotes must not swallow the rest of a message.
function withoutSpeech(text) {
  return text.replace(/"[^"]*"|„[^“”]*[“”]|“[^”]*”|«[^»]*»/gu, match => ' '.repeat(match.length));
}

// Negation or a plan elsewhere in a sentence must not erase an affirmed time
// marker. Scope exclusions to the cue's predicate; retain memory/conditional
// scope across commas, but reset at an explicit change of action.
function currentCue(value, match, kind) {
  if(/\b(?:usually|every morning|each morning|jeden morgen|gewöhnlich|normalerweise|üblicherweise)\b/iu.test(value))return false;
  if(['sleep','wake','eyes'].includes(kind)&&negated.test(match[0]))return false;
  if(/\bmorgen\b/iu.test(match[0])&&!/\b(?:am|nächsten|folgenden|darauffolgenden|heutigen|der|den|zum|ist|war|wird) morgen\b/iu.test(match[0]))return false;
  const before=value.slice(0,match.index);
  const semantic=before.split(/\b(?:but|aber|then|dann|danach|anschließend)\b/iu).at(-1);
  const local=before.split(/[,;]|\b(?:and|und|but|aber|sondern)\b/iu).at(-1);
  if(nonCurrent.test(semantic)||planned.test(semantic)||/\b(?:fear\p{L}*|afraid|worr\p{L}*|angst|befürcht\p{L}*|sorge\p{L}*)\b/iu.test(semantic)||negated.test(local))return false;
  const after=value.slice(match.index+match[0].length).split(/[,;]|\b(?:and|und|but|aber)\b/iu)[0];
  if(kind==='activity'&&/\b(?:werde|wirst|wird|werden|werdet)\b/iu.test(local))return false;
  if(kind==='activity'&&/^\s*(?:\p{L}+\s+){0,2}(?:nicht|not|never)\b/iu.test(after))return false;
  if(/\b(?:tomorrow|morgen)\b/iu.test(after)&&!/^\s*(?:am|im|zum|der|ist|war|wird) morgen\b/iu.test(after))return false;
  if(/\bmorgen\b/iu.test(before)&&!/\b(?:am|nächsten|folgenden|heutigen|der|den|zum|ist|war|wird) morgen\b/iu.test(before))return false;
  if(/\b(?:werde|wirst|wird|werden|werdet)\b[^.!?\n]{0,60}\b(?:aufwachen|einschlafen|schlafen gehen)\b/iu.test(value))return false;
  if(['nextMorning','nextDay','morning'].includes(kind)&&/^\s*,?\s*(?:\p{L}+\s+){0,3}(?:will|would|möchte\p{L}*|wollen)\b/iu.test(after))return false;
  return true;
}

export function narrativeCues(message) {
  if(message.kind==='thought'||message.kind==='intro'||message.superseded)return [];
  const text=withoutSpeech(message.text),cues=[];
  const clauses=[...text.matchAll(/(?:\d\.\d|[^.!?;\n*])+[.!?;\n]?/gu)];
  for(const clause of clauses) {
    const value=clause[0], offset=clause.index;
    const found=[];
    for(const [kind,pattern] of patterns) {
      pattern.lastIndex=0;
      for(const match of value.matchAll(pattern)){
        if(!currentCue(value,match,kind))continue;
        const cue={kind,offset:offset+match.index,end:offset+match.index+match[0].length,text:match[0]};
        if(kind==='daySkip'){
          const n={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,ein:1,eine:1,einen:1,zwei:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10};
          cue.days=(n[normalize(match[1])]??Number(match[1]))*(/^(week|woch)/iu.test(match[2])?7:1);
          if(!Number.isSafeInteger(cue.days)||cue.days<1||cue.days>36500)continue;
        }
        found.push(cue);
      }
    }
    // "The next morning" is one cue, not an extra morning + day transition.
    found.sort((a,b)=>a.offset-b.offset||b.end-a.end);
    for(const cue of found)if(!cues.some(old=>cue.offset>=old.offset&&cue.end<=old.end))cues.push(cue);
  }
  return cues.sort((a,b)=>a.offset-b.offset);
}

export function newDayState() {
  return {day:1,segment:null,phase:'unknown',confidence:'inferred',uncertain:false,sleeping:false,nap:false,midnightCounted:false,lastBoundary:null,lastMessage:null,lastPhaseMessage:null};
}

export function inferNarrativeDay(state, message, cues, {explicitDays=null,explicitDate=null,previousDate=null,explicitTime=null}={}) {
  state=structuredClone(state);state.segment??=message.id;
  const startDay=state.day,changes=[];
  // Numeric durations / dated checkpoints govern the same transition instead
  // of being added to an overnight cue describing it again.
  const dated=explicitDate&&previousDate?(Date.parse(explicitDate+'T00:00Z')-Date.parse(previousDate+'T00:00Z'))/86400000:null;
  const explicit=dated!==null?dated:explicitDays;
  let advanced=false,explicitConsumed=false;
  if(explicit!==null&&Number.isInteger(explicit)&&explicit!==0) {
    if(explicit<0){state.segment=message.id;state.day=1;state.uncertain=true;}
    else{state.day+=explicit;state.confidence=dated!==null?'dated':'explicit';advanced=true;}
    state.lastBoundary={id:message.id,role:message.role};
    if(explicit>0&&explicitTime&&Number(explicitTime.slice(0,2))<5)state.midnightCounted=true;
  }
  const boundary=(cue,force)=>{
    const echo=!!state.lastBoundary&&state.lastBoundary.id===state.lastMessage?.id && state.lastBoundary.role==='user'&&message.role==='assistant' && state.phase==='morning';
    if(dated!==0&&!advanced&&!echo&&!state.midnightCounted&&(force||['afternoon','evening','night'].includes(state.phase)||state.sleeping&&!state.nap)) {
      state.day++;state.confidence='inferred';state.lastBoundary={id:message.id,role:message.role};changes.push(cue);advanced=true;
    }
    state.phase='morning';state.sleeping=false;state.nap=false;state.midnightCounted=false;
  };
  for(const cue of cues) {
    if(cue.kind==='daySkip') {
      const echo=state.lastBoundary?.id===state.lastMessage?.id&&state.lastBoundary?.role==='user'&&message.role==='assistant'&&state.lastBoundary?.amount===cue.days;
      if(explicit!==null&&explicit>0&&!explicitConsumed)explicitConsumed=true;
      else if(!echo){state.day+=cue.days;state.confidence='explicit';}
      state.phase='unknown';state.sleeping=false;state.nap=false;advanced=true;
      state.lastBoundary={id:message.id,role:message.role,amount:cue.days};
    }
    else if(cue.kind==='unknown'){state.uncertain=true;state.segment=message.id;}
    else if(cue.kind==='nextMorning'||cue.kind==='nextDay')boundary(cue,true);
    else if(cue.kind==='morning')boundary(cue,false);
    else if(cue.kind==='wake'||cue.kind==='eyes') {
      // Waking at night or from an afternoon nap is not a new morning.
      const nocturnal=cues.some(c=>c.kind==='night'&&Math.abs(c.offset-cue.offset)<100);
      const shortAfter=cues.some(c=>c.kind==='shortSleep'&&c.offset>cue.end&&c.offset-cue.end<150&&!/[.!?;\n*]/u.test(message.text.slice(cue.end,c.offset)));
      if(!nocturnal&&!state.nap&&!shortAfter&&(cue.kind!=='eyes'||state.sleeping))boundary(cue,false);
      state.sleeping=false;state.nap=false;
    } else if(cue.kind==='nap'){state.nap=true;state.sleeping=false;}
    else if(cue.kind==='shortSleep'){if(state.sleeping||cues.some(c=>c.kind==='wake'&&c.offset>cue.end&&c.offset-cue.end<150&&!/[.!?;\n*]/u.test(message.text.slice(cue.end,c.offset))))state.nap=true;}
    else if(cue.kind==='sleep'){state.sleeping=true;state.nap=['morning','afternoon'].includes(state.phase)&&[message.id,state.lastMessage?.id].includes(state.lastPhaseMessage);advanced=false;}
    else {state.phase=cue.kind;state.lastPhaseMessage=message.id;if(['evening','night','afternoon'].includes(cue.kind))advanced=false;if(['evening','afternoon'].includes(cue.kind))state.midnightCounted=false;}
  }
  if(explicitTime&&Number(explicitTime.slice(0,2))>=5&&Number(explicitTime.slice(0,2))<18)state.midnightCounted=false;
  state.lastMessage={id:message.id,role:message.role};
  return {state,startDay,changes,changed:state.day!==startDay||cues.length>0};
}

const queryStop=new Set('how many much long when since days day weeks week time have been already start started working doing the and that this with from about your you our are was were can could would should did bitte kannst kann mir mich sagen schon viele viel lange seit wann tage tagen tag woche wochen zeit habe haben hatte hast hatte wurde wird waren sind ist ich du wir sie das der die den dem von zum zur und oder eine einem einen einem einer mein meine meiner diesem'.split(' '));
for(const word of 'work worked said told longer take took old out then please those laid been said told them these before after first also gesagt dir dich jetzt länger dauern dauert arbeite arbeiten gearbeitet arbeit weg vor ihm ihr hatte dort dass als noch bitte einem dem meinen hat wo den'.split(' '))queryStop.add(word);
const words=text=>[...new Set(normalize(text).match(/[\p{L}\p{N}]{3,}/gu)??[])].filter(w=>!queryStop.has(w));
const queryWords=query=>words(query.replace(/\*[^*]*\*/gu,' '));
const stem=word=>word.replace(/(?:ungen|ern|en|es|er|em|ing|ed|s)$/u,'');
export const isTimeQuestion=text=>/(?:how (?:many|long)|since when|when .* (?:start|began)|wie (?:viele?|lange)|seit wann|wieviel|welchem tag)/iu.test(text);
const phaseMention=/\b(?:(?:part|phase|stage|step|teil|abschnitt|arbeitsschritt)\s+(?:two|three|four|zwei|drei|vier|[2-9])|(?:second|third|next|zweite\p{L}*|dritte\p{L}*|nächste\p{L}*)\s+(?:part|phase|stage|step|teil|abschnitt|arbeitsschritt))\b/iu;
const onsetPattern=/\b(?:start\p{L}*|beg[aiu]n\p{L}*|fang\p{L}*|anfang\p{L}*|an die arbeit|(?:lay|laid|spread)\b[^.!?\n]{0,90}\bout|breit\p{L}*\b[^.!?\n]{0,90}\baus|leg\p{L}*\b[^.!?\n]{0,90}\baus|ausgebreit\p{L}*|ausgeleg\p{L}*)\b/iu;
const workOnset=/\b(?:start\p{L}*|beg[aiu]n\p{L}*|fang\p{L}*|anfang\p{L}*|an die arbeit)\b/iu;
const preparationQuery=/\b(?:laid|laying|spread|arrang\p{L}*|ausgebreit\p{L}*|ausgeleg\p{L}*|ausbreit\p{L}*|vor mir|in front of me)\b/iu;
const referenceKind=query=>phaseMention.test(query)?'phase':preparationQuery.test(query)?'preparation':'start';

function activityRole(message, terms) {
  // A proposal, a retrospective claim in dialogue, and a new work phase are
  // not fresh evidence that the whole activity began at this message.
  const text=withoutSpeech(message.text);
  let plan=false,phase=false;
  const phaseCue=text.match(phaseMention);
  const phasePrefix=phaseCue?text.slice(0,phaseCue.index).split(/[.!?;\n*]/u).at(-1):'';
  const commanded=message.role==='assistant'&&/^\s*(?:please\s+)?(?:start|begin|fang|fange|beginn|beginne)\b/iu.test(phasePrefix);
  if(phaseCue&&!commanded&&text.slice(phaseCue.index).match(/[.!?;\n*]/u)?.[0]!=='?'&&terms.some(t=>words(text.slice(Math.max(0,phaseCue.index-180),phaseCue.index+220)).map(stem).includes(t))&&currentCue(text,phaseCue,'activity'))return 'phase';
  for(const part of text.matchAll(/[^.!?;\n*]+/gu)){
    const value=part[0],work=value.match(workOnset);
    if(message.role==='assistant'&&/^\s*(?:please\s+)?(?:start|begin|fang|fange|beginn|beginne)\b/iu.test(value)){plan=true;continue;}
    if(work&&text[part.index+value.length]!=='?'&&currentCue(value,work,'activity')&&terms.some(t=>words(text.slice(Math.max(0,part.index-100),part.index+value.length+180)).map(stem).includes(t)))return 'start';
    if(!terms.some(t=>words(value).map(stem).includes(t)))continue;
    const onset=value.match(onsetPattern);
    const localPhase=value.match(phaseMention);
    if(localPhase){if(text[part.index+value.length]!=='?'&&currentCue(value,localPhase,'activity'))phase=true;else plan=true;continue;}
    if(onset&&currentCue(value,onset,'activity'))return 'preparation';
    if(nonCurrent.test(value)||planned.test(value)){plan=true;continue;}
  }
  return phase?'phase':plan?'plan':'progress';
}

export function activityStartSource(evidence,query) {
  const kind=referenceKind(query);
  return evidence.find(e=>e.activityRole===kind)?.sourceId??(kind==='start'?evidence.find(e=>e.activityRole==='preparation')?.sourceId:null)??null;
}

export function rankTimeEntries(entries, query) {
  if(!isTimeQuestion(query))return entries;
  const terms=queryWords(query).map(stem);
  const score=e=>{const tokens=words(`${e.key} ${e.text}`).map(stem);return terms.filter(t=>tokens.includes(t)).length;};
  return entries.map((entry,index)=>({entry,index,score:score(entry)})).sort((a,b)=>b.score-a.score||a.index-b.index).map(e=>e.entry);
}

export function recallTimeEvidence(story, clock, query) {
  if(!isTimeQuestion(query))return [];
  const terms=queryWords(query).map(stem).filter(w=>w.length>=3);
  if(!terms.length)return [];
  const candidates=[];
  for(const m of story.messages) {
    if(m.superseded||m.kind==='thought'||m.kind==='intro'||m.text===query||!clock.byMessage.has(m.id)||clock.invalidUsers.has(m.id))continue;
    if((story.suppression??[]).some(s=>normalize(m.text).includes(normalize(s.text))))continue;
    const tokens=words(m.text).map(stem);
    const hits=terms.filter(t=>tokens.includes(t));
    if(!hits.length)continue;
    const role=activityRole(m,terms);
    candidates.push({message:m,activityRole:role,hits:hits.length,score:hits.length*5+(role==='start'?3:0),order:clock.order.get(m.id)??0,anchor:Math.max(0,normalize(m.text).indexOf(hits[0]))});
  }
  candidates.sort((a,b)=>b.score-a.score||a.order-b.order);
  const requested=referenceKind(query);
  const matches=candidates.filter(c=>c.activityRole===requested);
  const bestHits=Math.max(0,...matches.map(c=>c.hits));
  const onset=requested==='phase'?matches[0]:matches.filter(c=>c.hits===bestHits).sort((a,b)=>a.order-b.order)[0];
  // Reserve the earliest grounded start even when many later phase/progress
  // messages repeat more query words. Keep both sides of the distinction.
  const related=['start','preparation','phase'].map(role=>candidates.filter(c=>c.activityRole===role).sort((a,b)=>b.hits-a.hits||a.order-b.order)[0]).filter(Boolean);
  const selected=[...new Set([...(onset?[onset]:[]),...related,...candidates])].slice(0,6);
  return selected.map(({message:m,anchor,activityRole})=>{
    const at=clock.byMessage.get(m.id),start=clock.messageStarts.get(m.id)??at;
    const same=at&&clock.current&&at.daySegment===clock.current.daySegment;
    const excerptStart=Math.max(0,anchor-450);
    return {sourceId:m.id,text:m.text.slice(excerptStart,excerptStart+1800),activityRole,startStoryDay:start?.storyDay??null,endStoryDay:at?.storyDay??null,
      dayChangesSinceEvidence:same?clock.current.storyDay-at.storyDay:null,uncertain:!same||start?.storyDay!==at?.storyDay};
  });
}
