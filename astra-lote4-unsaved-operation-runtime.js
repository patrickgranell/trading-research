/* Lote 4 - Explicit, in-dialog discard protection for manual operation forms. */
(function(){
'use strict';
if(typeof window==='undefined'||window.TradingResearchL4UnsavedOperation)return;
const interacted=new WeakSet();
function active(){
 const roots=[...document.querySelectorAll('.modal-backdrop')];
 const overlay=roots.at(-1);
 const dialog=overlay?.querySelector('[role="dialog"]');
 const form=dialog?.querySelector('#operationForm');
 return form?{overlay,dialog,form}:null;
}
function isEdited(form){
 return [...form.querySelectorAll('input,select,textarea')].some(el=>{
  if(el.disabled||el.readOnly||el.type==='hidden')return false;
  if(el.type==='checkbox'||el.type==='radio')return el.checked!==el.defaultChecked;
  if(el.type==='file')return !!el.files?.length;
  if(el.tagName==='SELECT'){
   const initial=[...el.options].find(x=>x.defaultSelected)?.value||el.options[0]?.value||'';
   return el.value!==initial;
  }
  return el.value!==el.defaultValue;
 });
}
function dirty(ctx){return interacted.has(ctx.dialog)&&isEdited(ctx.form);}
function promptDiscard(ctx){
 let box=ctx.dialog.querySelector('.tr4-unsaved-confirmation');
 if(box){box.querySelector('.tr4-keep-editing')?.focus();return;}
 box=document.createElement('div');box.className='tr4-unsaved-confirmation';
 box.setAttribute('role','alert');
 const copy=document.createElement('p');
 copy.textContent='Hay cambios sin guardar en la operación. Si cierras, perderás las notas y los demás campos modificados.';
 const buttons=document.createElement('div');buttons.className='tr4-unsaved-buttons';
 const keep=document.createElement('button');keep.type='button';keep.className='btn small tr4-keep-editing';keep.textContent='Seguir editando';
 keep.addEventListener('click',()=>{box.remove();ctx.form.querySelector('#f-notes,textarea,input')?.focus();});
 const discard=document.createElement('button');discard.type='button';discard.className='btn small danger';discard.textContent='Descartar cambios y cerrar';
 discard.addEventListener('click',()=>{box.remove();if(typeof window.closeModal==='function')window.closeModal();});
 buttons.append(keep,discard);box.append(copy,buttons);
 const footer=ctx.dialog.querySelector('.modal-foot');
 if(footer)footer.prepend(box);else ctx.dialog.append(box);
 keep.focus();
}
for(const kind of ['input','change']){
 window.addEventListener(kind,event=>{
  const ctx=active();
  if(ctx?.form.contains(event.target))interacted.add(ctx.dialog);
 },true);
}
window.addEventListener('click',event=>{
 const ctx=active();
 if(!ctx)return;
 const button=event.target.closest('button');
 if(!button||!ctx.dialog.contains(button))return;
 const action=(button.getAttribute('data-tr-action-click')||'')+' '+(button.getAttribute('data-tr-onclick')||'');
 if(!/closeModal/.test(action)||!/cancelar|cerrar/i.test(button.textContent||''))return;
 if(!dirty(ctx))return;
 event.preventDefault();event.stopImmediatePropagation();
 promptDiscard(ctx);
},true);
window.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 const ctx=active();if(!ctx||!dirty(ctx))return;
 event.preventDefault();event.stopImmediatePropagation();
 const existing=ctx.dialog.querySelector('.tr4-unsaved-confirmation');
 if(existing){existing.remove();ctx.form.querySelector('#f-notes,textarea,input')?.focus();}
 else promptDiscard(ctx);
},true);
window.TradingResearchL4UnsavedOperation=Object.freeze({version:1});
})();