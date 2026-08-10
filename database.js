'use strict';

let db;
const DEVICE_ID_KEY='munhuiDeviceId';
function getDeviceId(){
 let id=localStorage.getItem(DEVICE_ID_KEY);
 if(!id){id='DEV-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);localStorage.setItem(DEVICE_ID_KEY,id)}
 return id;
}
function makeRecordUid(){return getDeviceId()+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}


let manualPageIndex=0;
function getManualPages(){return [...document.querySelectorAll('#manualBook .manual-page')]}
function updateManualControls(){
 const pages=getManualPages();
 if(!pages.length)return;
 manualPageIndex=Math.max(0,Math.min(manualPageIndex,pages.length-1));
 pages.forEach((page,index)=>page.classList.toggle('active',index===manualPageIndex));
 const current=pages[manualPageIndex];
 document.getElementById('manualPrev').disabled=manualPageIndex===0;
 document.getElementById('manualNext').disabled=manualPageIndex===pages.length-1;
 document.getElementById('manualProgress').innerHTML=`${manualPageIndex+1} / ${pages.length}<small>${current.dataset.label||''}</small>`;
}
function goToManualPage(index){
 manualPageIndex=index;
 updateManualControls();
 document.getElementById('manual').scrollIntoView({block:'start',behavior:'smooth'});
}
function goToManualPrintedPage(pageNumber){
 const target=String(pageNumber).padStart(2,'0');
 const index=getManualPages().findIndex(page=>page.dataset.page===target);
 if(index>=0)goToManualPage(index);
}
function goToManualContents(){goToManualPage(1)}
function openManualContents(){showScreen('manual');goToManualPage(1)}
function changeManualPage(direction){goToManualPage(manualPageIndex+direction)}
function formatDilutionNumber(value){
 const digits=value>=100?1:value>=1?2:4;
 return new Intl.NumberFormat('ko-KR',{maximumFractionDigits:digits}).format(value);
}
function dilutionInputValue(value){
 const digits=value>=100?1:value>=1?2:4;
 return String(Number(value.toFixed(digits)));
}
function setDilutionMessage(html,isError=false){
 const result=document.getElementById('dilutionResult');
 if(!result)return;
 result.classList.toggle('error',isError);
 result.innerHTML=html;
}
function setDilutionRate(rate){
 const input=document.getElementById('dilutionRate');
 if(!input)return;
 input.value=rate;
 document.querySelectorAll('.dilution-preset').forEach(button=>button.classList.toggle('active',Number(button.dataset.rate)===rate));
 const water=Number(document.getElementById('dilutionWater').value);
 const chemical=Number(document.getElementById('dilutionChemical').value);
 if(water>0)calculateDilution('chemical');
 else if(chemical>0)calculateDilution('water');
 else setDilutionMessage(`<strong>${formatDilutionNumber(rate)}배</strong>를 선택했습니다. 물의 양 또는 약제량을 입력하세요.`);
}
function calculateDilution(target){
 const rate=Number(document.getElementById('dilutionRate').value);
 const waterInput=document.getElementById('dilutionWater');
 const chemicalInput=document.getElementById('dilutionChemical');
 const unit=document.getElementById('dilutionUnit').value;
 document.querySelectorAll('.dilution-preset').forEach(button=>button.classList.toggle('active',Number(button.dataset.rate)===rate));
 if(!Number.isFinite(rate)||rate<=0){setDilutionMessage('희석배수는 0보다 큰 숫자로 입력하세요.',true);return}
 if(target==='chemical'){
  const water=Number(waterInput.value);
  if(!Number.isFinite(water)||water<=0){setDilutionMessage('약제량을 구하려면 물의 양(L)을 0보다 크게 입력하세요.',true);waterInput.focus();return}
  const chemical=water*1000/rate;
  chemicalInput.value=dilutionInputValue(chemical);
  setDilutionMessage(`<strong>${formatDilutionNumber(chemical)} ${unit}</strong> 필요 · 물 ${formatDilutionNumber(water)} L를 ${formatDilutionNumber(rate)}배로 희석`);
  return;
 }
 const chemical=Number(chemicalInput.value);
 if(!Number.isFinite(chemical)||chemical<=0){setDilutionMessage('물의 양을 구하려면 가지고 있는 약제량을 0보다 크게 입력하세요.',true);chemicalInput.focus();return}
 const water=chemical*rate/1000;
 waterInput.value=dilutionInputValue(water);
 setDilutionMessage(`<strong>물 ${formatDilutionNumber(water)} L</strong> 필요 · 약제 ${formatDilutionNumber(chemical)} ${unit}을 ${formatDilutionNumber(rate)}배로 희석`);
}
function resetDilutionCalculator(){
 document.getElementById('dilutionRate').value=1000;
 document.getElementById('dilutionUnit').value='mL';
 document.getElementById('dilutionWater').value='';
 document.getElementById('dilutionChemical').value='';
 document.querySelectorAll('.dilution-preset').forEach(button=>button.classList.toggle('active',Number(button.dataset.rate)===1000));
 setDilutionMessage('희석배수와 알고 있는 값 하나를 입력한 뒤 계산 버튼을 누르세요.');
}
let manualTouchStartX=null;
document.addEventListener('touchstart',event=>{
 if(!document.getElementById('manual').classList.contains('active'))return;
 manualTouchStartX=event.changedTouches[0].clientX;
},{passive:true});
document.addEventListener('touchend',event=>{
 if(manualTouchStartX===null||!document.getElementById('manual').classList.contains('active'))return;
 const distance=event.changedTouches[0].clientX-manualTouchStartX;
 manualTouchStartX=null;
 if(Math.abs(distance)>55)changeManualPage(distance<0?1:-1);
},{passive:true});
document.addEventListener('keydown',event=>{
 if(!document.getElementById('manual').classList.contains('active'))return;
 if(event.key==='ArrowLeft')changeManualPage(-1);
 if(event.key==='ArrowRight')changeManualPage(1);
});

function localDateString(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function monthString(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',1800)}
function setLoading(on){document.getElementById('loading').classList.toggle('show',on)}

function openDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open('munhuiFarmDB',2);
  req.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('entries')){const s=d.createObjectStore('entries',{keyPath:'id'});s.createIndex('workDate','workDate',{unique:false})}};
  req.onsuccess=e=>{db=e.target.result;resolve(db)};req.onerror=()=>reject(req.error);
 })
}
function store(mode='readonly'){return db.transaction('entries',mode).objectStore('entries')}
function getAllEntries(){return new Promise((res,rej)=>{const r=store().getAll();r.onsuccess=()=>res(r.result.sort((a,b)=>(b.workDate+a.createdAt).localeCompare(a.workDate+a.createdAt)));r.onerror=()=>rej(r.error)})}
function getEntry(id){return new Promise((res,rej)=>{const r=store().get(Number(id));r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function putEntry(x){return new Promise((res,rej)=>{const r=store('readwrite').put(x);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function deleteEntryDB(id){return new Promise((res,rej)=>{const r=store('readwrite').delete(Number(id));r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
