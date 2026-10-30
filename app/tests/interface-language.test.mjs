import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../../public/i18n.js',import.meta.url),'utf8');
function harness(saved,{blocked=false}={}) {
 const events=new Map(),nodes=[],attributes=[],writes=[];
 const selector={value:'',addEventListener(name,callback){this[name]=callback;}};
 const body={querySelectorAll(){return attributes;}};
 const document={body,documentElement:{lang:''},title:'',addEventListener(name,fn){events.set(name,fn);},dispatchEvent(event){events.get(event.type)?.(event);},getElementById(){return selector;},querySelectorAll(){return [];},createTreeWalker(){let i=0;return {nextNode:()=>nodes[i++]??null};}};
 const context=vm.createContext({document,NodeFilter:{SHOW_TEXT:4},localStorage:{getItem(){if(blocked)throw Error('denied');return saved;},setItem(k,v){if(blocked)throw Error('denied');writes.push([k,v]);}},Event:class {constructor(type){this.type=type;}},MutationObserver:class {observe(){}},confirm:()=>true});
 function text(value,protectedContent=false){const node={textContent:value,parentElement:{tagName:'P',closest:()=>protectedContent?{}:null}};nodes.push(node);return node;}
 function attribute(value){const values={'aria-label':value};const element={closest:()=>null,hasAttribute:k=>k in values,getAttribute:k=>values[k],setAttribute:(k,v)=>{values[k]=v;}};attributes.push(element);return values;}
 vm.runInContext(source,context);events.get('DOMContentLoaded')();
 return {context,document,selector,writes,text,attribute,translate:()=>vm.runInContext('translateUI()',context),switch(locale){selector.value=locale;selector.change();}};
}
test('UI language defaults independently per browser and persists only validated local preference',()=>{
 const fresh=harness('unexpected');assert.equal(fresh.document.documentElement.lang,'en');const other=harness(null);const de=harness('de');assert.equal(de.document.documentElement.lang,'de');assert.equal(other.document.documentElement.lang,'en');fresh.switch('de');assert.deepEqual(fresh.writes,[['storychat:ui-language','de']]);assert.equal(other.document.documentElement.lang,'en');fresh.switch('invalid');assert.equal(fresh.document.documentElement.lang,'en');
 const blocked=harness(null,{blocked:true});assert.equal(blocked.document.documentElement.lang,'en');blocked.switch('de');assert.equal(blocked.document.documentElement.lang,'de');
});
test('switching localizes dynamic controls/accessibility and never changes protected authored text or drafts',()=>{
 const h=harness(null);const control=h.text('Stories'),authored=h.text('Stories',true),narrative=h.text('A German story: Grüße aus dem Garten.',true),draft=h.text('My unsent draft',true),aria=h.attribute('Start new story');
 h.switch('de');assert.equal(control.textContent,'Geschichten');assert.equal(aria['aria-label'],'Neue Geschichte beginnen');assert.equal(authored.textContent,'Stories');assert.equal(narrative.textContent,'A German story: Grüße aus dem Garten.');assert.equal(draft.textContent,'My unsent draft');
 const dynamic=h.text('Save definition');h.translate();assert.equal(dynamic.textContent,'Beschreibung speichern');h.switch('en');assert.equal(control.textContent,'Stories');assert.equal(dynamic.textContent,'Save definition');assert.equal(aria['aria-label'],'Start new story');
});
test('every static interface label has a German translation or an explicit language/brand exception',()=>{
 const h=harness(null);const keys=new Set(vm.runInContext('Object.keys(german)',h.context));const html=readFileSync(new URL('../../public/index.html',import.meta.url),'utf8');
 const exceptions=new Set(['Storychat · Your story continues','storychat','English','Deutsch']);
 const labels=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1].trim().replaceAll('&amp;','&')).filter(s=>s&&/[a-zA-Z]/.test(s));
 assert.deepEqual(labels.filter(s=>!keys.has(s)&&!exceptions.has(s)),[]);
});
