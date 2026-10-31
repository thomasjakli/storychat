'use strict';
// Limited narrative syntax, intentionally not Markdown. Storage always retains raw input.
(function(root){
function parse(text){
 const parts=[],plain=[],marked=[];let inside=false;
 const emit=()=>{if(plain.length){parts.push({text:plain.join(''),narration:false});plain.length=0;}};
 for(let i=0;i<text.length;i++){
  const target=inside?marked:plain;
  if(text[i]==='\\'&&text[i+1]==='*'){target.push('*');i++;continue;}
  if(text[i]==='*'){
   let end=i;while(text[end+1]==='*')end++;
   if(end>i){target.push(text.slice(i,end+1));i=end;continue;}
   if(inside){const value=marked.join('');marked.length=0;if(value.trim()){emit();parts.push({text:value,narration:true});}else plain.push('*',value,'*');inside=false;}
   else{inside=true;}
  }else target.push(text[i]);
 }
 if(inside)plain.push('*',...marked);emit();return parts;
}
function wrap(text,start,end,max=8000){
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>text.length)throw new RangeError('Invalid selection');
 // Native selections are UTF-16 offsets; never split a surrogate pair.
 const split=p=>p>0&&p<text.length&&/[\uD800-\uDBFF]/.test(text[p-1])&&/[\uDC00-\uDFFF]/.test(text[p]);
 if(split(start))start--;if(split(end))end++;
 if(text.length+2>max)return null;
 return {text:text.slice(0,start)+'*'+text.slice(start,end)+'*'+text.slice(end),start:start+1,end:end+1};
}
function render(element,text){element.replaceChildren();for(const part of parse(text)){const node=element.ownerDocument.createElement('span');if(part.narration)node.className='narration-span';node.textContent=part.text;element.append(node);}return element;}
function attach(textarea,button,onLimit){
 let saved=null;
 const capture=()=>{saved={value:textarea.value,start:textarea.selectionStart,end:textarea.selectionEnd};};
 for(const name of ['select','keyup','input','focus','blur'])textarea.addEventListener(name,capture);
 button.addEventListener('pointerdown',event=>{if(document.activeElement===textarea)capture();if(event.pointerType==='mouse')event.preventDefault();});
 button.addEventListener('click',()=>{
  if(textarea.disabled||textarea.readOnly)return;
  const selection=saved?.value===textarea.value?saved:{start:textarea.selectionStart,end:textarea.selectionEnd};
  const result=wrap(textarea.value,selection.start,selection.end,textarea.maxLength>0?textarea.maxLength:8000);
  if(!result){onLimit?.();return;}
  textarea.focus({preventScroll:true});textarea.setRangeText(result.text,0,textarea.value.length,'preserve');
  // Use computed replacement to keep artificial/OS surrogate-boundary selections safe.
  textarea.setSelectionRange(result.start,result.end);textarea.dispatchEvent(new Event('input',{bubbles:true}));capture();
 });
}
root.StoryNarration={parse,wrap,render,attach};
})(globalThis);
