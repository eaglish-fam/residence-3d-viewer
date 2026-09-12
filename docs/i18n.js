import {strings} from './strings.js';
const storageKey='residence-viewer-language';
let language='en',progressKey='initialProgress',progressVars={};
const listeners=new Set();
try{const saved=localStorage.getItem(storageKey);if(saved in strings.ui)language=saved;}catch{}
const requested=new URLSearchParams(location.search).get('lang');
if(requested==='en'||requested==='zh-Hant'||requested==='zh')language=requested==='zh'?'zh-Hant':requested;
export const getLanguage=()=>language;
export function t(key,vars={}){return (strings.ui[language][key]??strings.ui.en[key]??key).replace(/\{(\w+)\}/g,(_,name)=>String(vars[name]??''));}
export function viewText(id){return strings.views[language][id]??strings.views.en[id];}
export function onLanguageChange(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function setProgress(key,vars={}){progressKey=key;progressVars=vars;const el=document.querySelector('#progress');if(el)el.textContent=t(key,vars);}
function render(){
 document.documentElement.lang=language;
 document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
 for(const [data,attr] of [['data-i18n-aria','aria-label'],['data-i18n-title','title'],['data-i18n-alt','alt']])document.querySelectorAll('['+data+']').forEach(el=>el.setAttribute(attr,t(el.getAttribute(data))));
 document.querySelector('#language-select').value=language;
 setProgress(progressKey,progressVars);
 listeners.forEach(fn=>fn(language));
}
export function setLanguage(next){if(!(next in strings.ui))return;language=next;try{localStorage.setItem(storageKey,next);}catch{}const url=new URL(location.href);if(url.searchParams.has('lang')){url.searchParams.set('lang',next);history.replaceState(null,'',url);}render();}
document.querySelector('#language-select').addEventListener('change',e=>setLanguage(e.target.value));
render();
