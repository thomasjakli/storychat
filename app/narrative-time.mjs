// Source-grounded narrative cues, not a wall-clock or a general language parser.
// The ordered state machine deliberately keeps day inference separate from minutes.
const normalize = value => value.normalize('NFKC').toLocaleLowerCase();
const nonCurrent = /\b(?:remember(?:s|ed|ing)?|recall(?:s|ed)?|dream(?:s|ed|ing)?|imagin(?:e|es|ed|ing)|would|could|might|will|think(?:s|ing)?|thought|yesterday|used to|last (?:night|week)|earlier that (?:day|morning)|flashback|rückblick|erinner\p{L}*|träum\p{L}*|vorstell\p{L}*|würde\p{L}*|könnte\p{L}*|denk\p{L}*|überleg\p{L}*|gestern|damals|letzte[nrsm]? (?:nacht|woche))\b/iu;
const negated = /\b(?:not|never|didn't|doesn't|don't|isn't|is not|nicht|nie|kein\p{L}*)\b/iu;
const planned = /\b(?:tomorrow|plan\p{L}*|want\p{L}*|intend\p{L}*|hope\p{L}*|wish\p{L}*|if|wenn|möchte\p{L}*|wollen|will ich|will er|will sie|willst|soll\p{L}*|hoff\p{L}*)\b/iu;
const patterns = [
  ['daySkip', /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ein|eine|einen|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s+(days?|weeks?|nights?|tage?|wochen?|nächte?)\s+(?:later|später)\b/giu],
  ['unknown', /\b(?:some time later|an unspecified time later|einige zeit später|irgendwann später)\b/giu],
  ['nextMorning', /\b(?:the (?:next|following) morning|next morning|(?:am|an dem) (?:nächsten|folgenden) morgen|(?:der|ein) (?:nächste|folgende|neue) morgen|nächster morgen|morgens darauf)\b/giu],
  ['nextDay', /\b(?:the (?:next|following) day|next day|(?:am|an dem) (?:nächsten|folgenden) tag|(?:der|ein) (?:nächste|folgende|neue) tag|einen tag später|a day later)\b/giu],
  ['morning', /\b(?:it (?:is|was) (?:now |already )?morning|morning (?:light|sun|sunlight)|dawn (?:breaks|broke)|es (?:ist|war|wird) (?:nun |schon |bereits )?morgen|morgenlicht|morgensonne|(?:im|beim) morgengrauen|(?:der|ein) morgen (?:bricht|brach|dämmert))\b/giu],
  ['evening', /\b(?:it (?:is|was|gets|grew) (?:now |already |late )?evening|evening (?:light|sun)|the sun (?:sets|set)|es (?:ist|war|wird|wurde) (?:nun |schon |bereits |später )?abend|abendlicht|abendsonne|die sonne (?:geht unter|ging unter)|(?:am|gegen) (?:späten )?abend)\b/giu],
  ['afternoon', /\b(?:in the afternoon|it (?:is|was) (?:now )?afternoon|(?:am|gegen) nachmittag|es (?:ist|war|wird) (?:nun )?nachmittag)\b/giu],
  ['night', /\b(?:it (?:is|was|gets|grew) (?:now |already |late )?night|es (?:ist|war|wird|wurde) (?:nun |schon |bereits |späte )?nacht|(?:mitten|in der mitte) (?:in der|der) nacht|middle of the night)\b/giu],
  ['nap', /\b(?:nap|naps|napping|napped|nickerchen|mittagsschlaf)\b/giu],
  ['sleep', /\b(?:fall(?:s)? asleep|fell asleep|go(?:es)? to (?:sleep|bed)|went to (?:sleep|bed)|sleep(?:s)? through the night|(?:schlaf\p{L}*|schläf\p{L}*|schlief\p{L}*) (?:\p{L}+ ){0,3}ein|eingeschlafen|(?:geh\p{L}*|ging\p{L}*|leg\p{L}*) (?:\p{L}+ ){0,3}(?:ins bett|schlafen)|(?:schlaf\p{L}*|schlief\p{L}*) (?:\p{L}+ ){0,3}(?:durch|bis zum morgen))\b/giu],
  ['wake', /\b(?:wak(?:e(?:s)?|ing) up|woke up|aufwach\p{L}*|aufgewacht|(?:werd\p{L}*|wurd\p{L}*) (?:\p{L}+ ){0,3}wach|awaken(?:s|ed)?|wach\p{L}* (?:\p{L}+ ){0,3}auf|erwach\p{L}*|erwacht\p{L}*)\b/giu],
  ['eyes', /\b(?:open(?:s|ed)? (?:my|his|her|our|their) eyes|öffne\p{L}* (?:\p{L}+ ){0,3}augen)\b/giu],
];

// Preserve offsets and asterisks; remove only clear quotation spans. Apostrophes
// in contractions and unmatched quotes must not swallow the rest of a message.
function withoutSpeech(text) {
  return text.replace(/"[^"]*"|„[^“”]*[“”]|“[^”]*”|«[^»]*»/gu, match => ' '.repeat(match.length));
}

export function narrativeCues(message) {
  if(message.kind==='thought'||message.kind==='intro'||message.superseded)return [];
  const text=withoutSpeech(message.text),cues=[];
  const clauses=[...text.matchAll(/[^.!?;\n]+[.!?;\n]?/gu)];
  for(const clause of clauses) {
    const value=clause[0], offset=clause.index;
    if(nonCurrent.test(value)||negated.test(value)||planned.test(value)||/\b(?:werde|wirst|wird|werden|werdet)\b[^.!?\n]{0,60}\b(?:aufwachen|einschlafen|schlafen gehen)\b/iu.test(value))continue;
    if(/\bmorgen\b/iu.test(value)&&!/\b(?:am|nächsten|folgenden|heutigen|der|den|zum|ist|war|wird) morgen\b/iu.test(value))continue;
    const found=[];
    for(const [kind,pattern] of patterns) {
      pattern.lastIndex=0;
      for(const match of value.matchAll(pattern)){
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
  return {day:1,segment:null,phase:'unknown',confidence:'inferred',uncertain:false,sleeping:false,nap:false,midnightCounted:false,lastBoundary:null,lastMessage:null};
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
      if(!nocturnal&&!state.nap&&(cue.kind!=='eyes'||state.sleeping))boundary(cue,false);
      state.sleeping=false;state.nap=false;
    } else if(cue.kind==='nap'){state.nap=true;state.sleeping=false;}
    else if(cue.kind==='sleep'){state.sleeping=true;if(['morning','afternoon'].includes(state.phase))state.nap=true;}
    else {state.phase=cue.kind;if(['evening','night','afternoon'].includes(cue.kind))advanced=false;if(['evening','afternoon'].includes(cue.kind))state.midnightCounted=false;}
  }
  if(explicitTime&&Number(explicitTime.slice(0,2))>=5&&Number(explicitTime.slice(0,2))<18)state.midnightCounted=false;
  state.lastMessage={id:message.id,role:message.role};
  return {state,startDay,changes,changed:state.day!==startDay||cues.length>0};
}

const queryStop=new Set('how many much long when since days day weeks week time have been already start started working doing the and that this with from about your you our are was were can could would should did bitte kannst kann mir mich sagen schon viele viel lange seit wann tage tagen tag woche wochen zeit habe haben hatte hast hatte wurde wird waren sind ist ich du wir sie das der die den dem von zum zur und oder eine einem einen einem einer mein meine meiner diesem'.split(' '));
const words=text=>[...new Set(normalize(text).match(/[\p{L}\p{N}]{3,}/gu)??[])].filter(w=>!queryStop.has(w));
const stem=word=>word.replace(/(?:ungen|ern|en|es|er|em|ing|ed|s)$/u,'');
export const isTimeQuestion=text=>/(?:how (?:many|long)|since when|when .* (?:start|began)|wie (?:viele?|lange)|seit wann|wieviel|welchem tag)/iu.test(text);

export function rankTimeEntries(entries, query) {
  if(!isTimeQuestion(query))return entries;
  const terms=words(query).map(stem);
  const score=e=>{const tokens=words(`${e.key} ${e.text}`).map(stem);return terms.filter(t=>tokens.includes(t)).length;};
  return entries.map((entry,index)=>({entry,index,score:score(entry)})).sort((a,b)=>b.score-a.score||a.index-b.index).map(e=>e.entry);
}

export function recallTimeEvidence(story, clock, query) {
  if(!isTimeQuestion(query))return [];
  const terms=words(query).map(stem).filter(w=>w.length>=3);
  if(!terms.length)return [];
  const candidates=[];
  for(const m of story.messages) {
    if(m.superseded||m.kind==='thought'||m.kind==='intro'||m.text===query||!clock.byMessage.has(m.id)||clock.invalidUsers.has(m.id))continue;
    if((story.suppression??[]).some(s=>normalize(m.text).includes(normalize(s.text))))continue;
    const tokens=words(m.text).map(stem);
    const hits=terms.filter(t=>tokens.includes(t));
    if(!hits.length)continue;
    const onset=/\b(?:start\p{L}*|beg[aiu]n\p{L}*|first|erst\p{L}*|fang\p{L}*|fäng\p{L}*|anfang\p{L}*|leg\p{L}*|laid|spread|ausgebreit\p{L}*)\b/iu.test(m.text);
    candidates.push({message:m,score:hits.length*5+(onset?3:0),order:clock.order.get(m.id)??0,anchor:Math.max(0,normalize(m.text).indexOf(hits[0]))});
  }
  candidates.sort((a,b)=>b.score-a.score||a.order-b.order);
  const selected=candidates.slice(0,6).sort((a,b)=>a.order-b.order);
  return selected.map(({message:m,anchor})=>{
    const at=clock.byMessage.get(m.id),start=clock.messageStarts.get(m.id)??at;
    const same=at&&clock.current&&at.daySegment===clock.current.daySegment;
    const excerptStart=Math.max(0,anchor-450);
    return {sourceId:m.id,text:m.text.slice(excerptStart,excerptStart+1800),startStoryDay:start?.storyDay??null,endStoryDay:at?.storyDay??null,
      dayChangesSinceEvidence:same?clock.current.storyDay-at.storyDay:null,uncertain:!same||start?.storyDay!==at?.storyDay};
  });
}
