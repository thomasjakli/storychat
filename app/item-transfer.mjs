import {validateTransfer} from './transfer.mjs';
import {characterFields,personaFields} from './store.mjs';

const invalid=()=>{throw Object.assign(new Error('Select a supported package containing exactly one character or persona and no stories.'),{code:'invalid'});};

// This is the data portion of the existing media-aware notebook envelope.
// Dedicated routes distinguish additive item transfer from collision-safe restore.
export function validateItem(input) {
  const data=validateTransfer(input);
  if(data.library.length!==1||data.stories.length!==0)invalid();
  const {type,data:record}=data.library[0];
  if(!record.name.trim()||(!record.definition.trim()&&!(type==='character'&&record.draft)))invalid();
  return data;
}

export function exportItem(store,type,id) {
  if(!['character','persona'].includes(type))invalid();
  return validateItem({format:'storychat',version:1,library:[{type,data:store.definition(id,type)}],stories:[]});
}

export function importItem(store,input) {
  const {type,data}=validateItem(input).library[0];
  // Library identity/version/timestamps are deliberately fresh. No story is touched.
  const fields=type==='character'?[...characterFields,'draft','favorite']:personaFields;
  const content={name:data.name,definition:data.definition};
  for(const field of fields)if(data[field]!==undefined)content[field]=structuredClone(data[field]);
  return {type,data:store.createDefinition(type,content)};
}
