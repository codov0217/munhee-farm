const fields=['중앙밭','계곡옆밭','과실수밭','오미자밭','수국밭','하우스밭','장독밭'];
const works=['파종','심기·정식','관수','비료','농약 방제','제초','예초','전정','수확','선별','포장','출하','장비 정비','기타'];
const workers=['아버지','어머니','본인','함께 작업'];
let selectedField='',selectedWork='',selectedWorker='',pendingPhotos=[],galleryTempPhotos=[],lastSavedEntry=null;
let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let selectedCalendarDate=localDateString(new Date());
const DEVICE_ID_KEY='munhuiDeviceId';
function getDeviceId(){
 let id=localStorage.getItem(DEVICE_ID_KEY);
 if(!id){id='DEV-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);localStorage.setItem(DEVICE_ID_KEY,id)}
 return id;
}
function makeRecordUid(){return getDeviceId()+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
const SHEETS_API='https://script.google.com/macros/s/AKfycbwD42304GtXO-iVt8vpnu7iztA6Y18_uzNdFkPnCrpVqHweQOWc0gs4eY9MDIx40j18sA/exec';
function setSyncStatus(message,state='checking'){
 const el=document.getElementById('syncStatus');if(!el)return;
 el.textContent=message;el.dataset.state=state;
}
async function sheetSave(entry){
 const record={...entry,photos:[]};
 const r=await fetch(SHEETS_API,{method:'POST',body:JSON.stringify({action:'save',record})});
 // Apps Script는 저장을 끝낸 뒤 빈 응답 또는 JSON이 아닌 응답을 돌려줄 때가 있습니다.
 // 이 경우 실제로는 시트에 저장됐는데도 r.json()이 실패해 '휴대폰에만 저장됨'으로 잘못 표시됐습니다.
 if(!r.ok)throw new Error('시트 저장 요청 실패');
 const body=await r.text();
 if(!body.trim())return;
 let data;
 try{data=JSON.parse(body)}catch(error){return}
 if(data && data.ok===false)throw new Error(data.message||'시트 저장 실패');
}
async function sheetDelete(recordUid){
 const r=await fetch(SHEETS_API,{method:'POST',body:JSON.stringify({action:'delete',record:{recordUid}})});
 const data=await r.json();if(!data.ok)throw new Error(data.message||'시트 삭제 실패');
}
async function syncFromSheet(showResult=false){
 setSyncStatus('공용 시트 불러오는 중…','checking');
 setLoading(true);try{const r=await fetch(SHEETS_API);const data=await r.json();if(!data.ok)throw new Error(data.message);
  const local=await getAllEntries(), byUid=new Map(local.map(x=>[x.recordUid,x]));
  for(const row of data.records){const old=byUid.get(row.recordUid);if(!old||String(row.updatedAt)>String(old.updatedAt))await putEntry({...old,...row,id:old?.id||Date.now()+Math.floor(Math.random()*999),deviceId:old?.deviceId||'SHEET',photos:old?.photos||[]});}
  await renderJournal();setSyncStatus(`연결됨 · 공용 기록 ${data.records.length}건`,'connected');if(showResult)showToast('공용 작업기록을 불러왔습니다');
 }catch(e){setSyncStatus('연결 실패 · 새로고침 후 다시 확인','error');if(showResult)showToast('공용 시트 연결을 확인해 주세요')}finally{setLoading(false)}
}


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
function openDilutionCalculator(){showScreen('manual');goToManualPrintedPage(82)}
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
let manualTouchStart=null;
document.addEventListener('touchstart',event=>{
 if(!document.getElementById('manual').classList.contains('active'))return;
 const touch=event.changedTouches[0];
 manualTouchStart={x:touch.clientX,y:touch.clientY};
},{passive:true});
document.addEventListener('touchend',event=>{
 if(manualTouchStart===null||!document.getElementById('manual').classList.contains('active'))return;
 const touch=event.changedTouches[0];
 const horizontal=touch.clientX-manualTouchStart.x;
 const vertical=touch.clientY-manualTouchStart.y;
 manualTouchStart=null;
 if(Math.abs(horizontal)>55&&Math.abs(horizontal)>Math.abs(vertical)*1.35)changeManualPage(horizontal<0?1:-1);
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

async function migrateOldData(){
 const old=JSON.parse(localStorage.getItem('munhuiEntries')||'[]'); if(!old.length)return;
 const existing=await getAllEntries(); if(existing.length)return;
 for(const x of old){await putEntry({...x,workDate:x.workDate||localDateString(new Date(x.date)),createdAt:x.date||new Date().toISOString(),amount:x.amount||'',photos:[]})}
 showToast('기존 작업기록을 가져왔습니다');
}

function makeChoices(id,items,type){
 const wrap=document.getElementById(id);wrap.innerHTML='';
 items.forEach(item=>{const b=document.createElement('button');b.type='button';b.className='choice';b.textContent=item;b.onclick=()=>choose(type,item,b,wrap);wrap.appendChild(b)})
}
function choose(type,item,btn,wrap){[...wrap.children].forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');if(type==='field')selectedField=item;if(type==='work')selectedWork=item;if(type==='worker')selectedWorker=item}
function selectChoice(id,value){[...document.getElementById(id).children].forEach(b=>b.classList.toggle('selected',b.textContent===value))}
function setCrop(v){document.getElementById('crop').value=v}

function showScreen(id){
 document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));
 if(id==='journal')renderJournal();if(id==='search')runSearch();if(id==='stats')renderStats();if(id==='register')renderRecentWorks();if(id==='manual')updateManualControls();window.scrollTo({top:0,behavior:'smooth'})
}
function openNewEntry(){resetForm();showScreen('register');renderRecentWorks()}
function resetForm(){
 document.getElementById('editId').value='';document.getElementById('formTitle').textContent='작업 등록';document.getElementById('workDate').value=localDateString(new Date());
 document.getElementById('crop').value='';document.getElementById('amount').value='';document.getElementById('memo').value='';
 selectedField=selectedWork=selectedWorker='';pendingPhotos=[];document.querySelectorAll('.choice').forEach(x=>x.classList.remove('selected'));renderPhotoPreview();const note=document.getElementById('photoSavedNote');if(note)note.classList.remove('show');const cp=document.getElementById('copyPanel');if(cp)cp.classList.remove('show')
}

async function resizeImage(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>{
   const img=new Image();img.onerror=()=>reject(new Error('이미지를 읽을 수 없습니다'));img.onload=()=>{
    const max=1280,scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.78))
   };img.src=reader.result
  };reader.readAsDataURL(file)
 })
}
async function processPhotoFiles(files, mode){
 if(!files.length)return;
 if(pendingPhotos.length>=3){showToast('사진은 최대 3장까지 저장됩니다');return}
 setLoading(true);
 try{
  let added=0;
  for(const f of files){
   if(pendingPhotos.length>=3)break;
   pendingPhotos.push(await resizeImage(f));
   added++;
  }
  renderPhotoPreview();
  const note=document.getElementById('photoSavedNote');
  note.textContent=mode==='camera'?'촬영한 사진이 작업에 바로 추가되었습니다.':`${added}장의 사진이 작업에 추가되었습니다.`;
  note.classList.add('show');
  setTimeout(()=>note.classList.remove('show'),2200);
  if(files.length>added)showToast('사진은 최대 3장까지 저장됩니다');
 }catch(err){
  alert('사진 처리 중 문제가 발생했습니다.');
 }finally{
  document.getElementById('cameraInput').value='';
  document.getElementById('galleryInput').value='';
  setLoading(false);
 }
}
async function addCameraPhoto(e){
 const files=[...e.target.files].slice(0,1);
 await processPhotoFiles(files,'camera');
}
function openGalleryPicker(){
 const input=document.getElementById('galleryInput');
 if(input.showPicker) input.showPicker();
 else input.click();
}
async function prepareGalleryPhotos(e){
 const files=[...e.target.files];
 if(!files.length)return;
 setLoading(true);
 galleryTempPhotos=[];
 try{
  const available=Math.max(0,3-pendingPhotos.length);
  for(const f of files.slice(0,available)){
   galleryTempPhotos.push(await resizeImage(f));
  }
  renderGalleryReview();
  document.getElementById('galleryReview').classList.add('open');
  if(files.length>available)showToast('사진은 작업당 최대 3장입니다');
 }catch(err){
  alert('사진 처리 중 문제가 발생했습니다.');
 }finally{
  e.target.value='';
  setLoading(false);
 }
}
function renderGalleryReview(){
 const grid=document.getElementById('galleryReviewGrid');
 document.getElementById('galleryReviewNote').textContent=
   `${galleryTempPhotos.length}장 선택됨 · 작업당 최대 3장`;
 grid.innerHTML=galleryTempPhotos.map((p,i)=>`
   <div class="gallery-review-item">
     <img src="${p}" alt="선택한 사진">
     <button type="button" onclick="removeGalleryTemp(${i})">×</button>
   </div>`).join('');
}
function removeGalleryTemp(i){
 galleryTempPhotos.splice(i,1);
 renderGalleryReview();
}
function cancelGallerySelection(){
 galleryTempPhotos=[];
 document.getElementById('galleryReview').classList.remove('open');
}
function completeGallerySelection(){
 if(!galleryTempPhotos.length){
  cancelGallerySelection();
  return;
 }
 pendingPhotos.push(...galleryTempPhotos);
 galleryTempPhotos=[];
 renderPhotoPreview();
 document.getElementById('galleryReview').classList.remove('open');
 const note=document.getElementById('photoSavedNote');
 note.textContent='선택한 사진이 작업에 추가되었습니다.';
 note.classList.add('show');
 setTimeout(()=>note.classList.remove('show'),2200);
}
function renderPhotoPreview(){document.getElementById('photoPreview').innerHTML=pendingPhotos.map((p,i)=>`<div class="photo-box"><img src="${p}" alt="선택한 사진"><button class="photo-remove" type="button" onclick="removePhoto(${i})">×</button></div>`).join('')}
function removePhoto(i){pendingPhotos.splice(i,1);renderPhotoPreview()}


function getFavorites(){return JSON.parse(localStorage.getItem('munhuiFavorites')||'[]')}
function saveFavorites(list){localStorage.setItem('munhuiFavorites',JSON.stringify(list))}
function entrySignature(x){return [x.field,x.crop,x.work,x.worker,x.amount||'',x.memo||''].join('||')}
function isFavorite(x){return getFavorites().some(f=>f.signature===entrySignature(x))}
function toggleFavorite(id){
 getEntry(id).then(x=>{
  if(!x)return;
  let list=getFavorites();const sig=entrySignature(x);const idx=list.findIndex(f=>f.signature===sig);
  if(idx>=0){list.splice(idx,1);showToast('즐겨찾기에서 해제했습니다')}
  else{list.unshift({signature:sig,field:x.field,crop:x.crop,work:x.work,worker:x.worker,amount:x.amount||'',memo:x.memo||''});showToast('즐겨찾기에 추가했습니다')}
  saveFavorites(list);renderRecentWorks();
 })
}
function loadTemplate(x){
 resetForm();
 document.getElementById('workDate').value=localDateString(new Date());
 document.getElementById('crop').value=x.crop||'';
 document.getElementById('amount').value=x.amount||'';
 document.getElementById('memo').value=x.memo||'';
 selectedField=x.field||'';selectedWork=x.work||'';selectedWorker=x.worker||'';
 selectChoice('fieldChoices',selectedField);selectChoice('workChoices',selectedWork);selectChoice('workerChoices',selectedWorker);
 pendingPhotos=[];renderPhotoPreview();showToast('이전 작업을 불러왔습니다');
 window.scrollTo({top:0,behavior:'smooth'});
}
async function renderRecentWorks(){
 const wrap=document.getElementById('recentWorks');if(!wrap)return;
 const all=await getAllEntries();const favs=getFavorites();
 const seen=new Set(),recent=[];
 for(const x of all){const sig=entrySignature(x);if(!seen.has(sig)){seen.add(sig);recent.push(x)}if(recent.length>=5)break}
 const merged=[
  ...favs.map((f,i)=>({...f,id:`fav-${i}`,favorite:true})),
  ...recent.filter(x=>!favs.some(f=>f.signature===entrySignature(x))).map(x=>({...x,favorite:false}))
 ];
 if(!merged.length){wrap.innerHTML='<div class="empty" style="padding:18px 6px">저장된 작업이 생기면 여기에 최근 작업이 표시됩니다.</div>';return}
 wrap.innerHTML=merged.slice(0,8).map(x=>`
  <div class="recent-item">
   <div class="recent-main">
    <div>
      <strong>${x.favorite?'⭐ ':''}${esc(x.field)} · ${esc(x.crop)} · ${esc(x.work)}</strong>
      <div class="recent-sub">${esc(x.worker)}${x.amount?` · ${esc(x.amount)}`:''}${x.memo?`<br>${esc(x.memo)}`:''}</div>
    </div>
   </div>
   <div class="recent-actions">
    <button class="btn small primary" onclick='loadTemplate(${JSON.stringify({field:x.field,crop:x.crop,work:x.work,worker:x.worker,amount:x.amount||"",memo:x.memo||""})})'>불러오기</button>
    ${typeof x.id==='number'?`<button class="star-btn ${isFavorite(x)?'active':''}" onclick="toggleFavorite(${x.id})">${isFavorite(x)?'★':'☆'}</button>`:''}
   </div>
  </div>`).join('');
}
function copyLastSaved(){
 if(!lastSavedEntry)return;
 loadTemplate(lastSavedEntry);
 document.getElementById('copyPanel').classList.remove('show');
}
async function saveEntry(){
 const editId=document.getElementById('editId').value,workDate=document.getElementById('workDate').value,crop=document.getElementById('crop').value.trim(),amount=document.getElementById('amount').value.trim(),memo=document.getElementById('memo').value.trim();
 if(!workDate)return alert('작업 날짜를 선택해 주세요.');if(!selectedField)return alert('필지를 선택해 주세요.');if(!crop)return alert('작물 이름을 입력해 주세요.');if(!selectedWork)return alert('작업 종류를 선택해 주세요.');if(!selectedWorker)return alert('작업자를 선택해 주세요.');
 setLoading(true);
 try{
  let old=editId?await getEntry(editId):null;
  const entry={id:editId?Number(editId):Date.now(),recordUid:old?.recordUid||makeRecordUid(),deviceId:old?.deviceId||getDeviceId(),workDate,field:selectedField,crop,work:selectedWork,worker:selectedWorker,amount,memo,photos:[...pendingPhotos],createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  await putEntry(entry);try{await sheetSave(entry);setSyncStatus('연결됨 · 방금 저장 완료','connected')}catch(e){setSyncStatus('연결 실패 · 휴대폰에만 저장됨','error');showToast('휴대폰에는 저장됨 · 공용 시트 연결 확인 필요')};lastSavedEntry={...entry,photos:[]};selectedCalendarDate=workDate;const [y,m]=workDate.split('-').map(Number);calendarMonth=new Date(y,m-1,1);showToast(editId?'수정되었습니다':'저장되었습니다');resetForm();showScreen('register');document.getElementById('copyPanel').classList.add('show');renderRecentWorks()
 }catch(err){alert('저장하지 못했습니다. 휴대폰 저장공간을 확인해 주세요.')}finally{setLoading(false)}
}
async function editEntry(id){
 const x=await getEntry(id);if(!x)return;document.getElementById('editId').value=x.id;document.getElementById('formTitle').textContent='작업 수정';document.getElementById('workDate').value=x.workDate;
 document.getElementById('crop').value=x.crop;document.getElementById('amount').value=x.amount||'';document.getElementById('memo').value=x.memo||'';selectedField=x.field;selectedWork=x.work;selectedWorker=x.worker;pendingPhotos=[...(x.photos||[])];
 selectChoice('fieldChoices',x.field);selectChoice('workChoices',x.work);selectChoice('workerChoices',x.worker);renderPhotoPreview();showScreen('register')
}
async function removeEntry(id){if(!confirm('이 작업기록을 삭제할까요?'))return;const entry=await getEntry(id);await deleteEntryDB(id);try{if(entry?.recordUid)await sheetDelete(entry.recordUid);setSyncStatus('연결됨 · 삭제 내용 반영 완료','connected')}catch(e){setSyncStatus('연결 실패 · 이 기기에서만 삭제됨','error')}showToast('삭제되었습니다');await renderJournal();if(document.getElementById('search').classList.contains('active'))runSearch();if(document.getElementById('stats').classList.contains('active'))renderStats()}

function entryCard(x){
 const photos=(x.photos||[]).map(p=>`<div class="photo-box" onclick="openPhoto('${p}')"><img src="${p}" alt="작업 사진"></div>`).join('');
 return `<article class="entry"><div class="entry-top"><strong>${esc(x.field)} · ${esc(x.crop)}</strong><time>${esc(x.workDate)}</time></div><div class="meta">작업: ${esc(x.work)}<br>작업자: ${esc(x.worker)}${x.amount?`<br>작업량: ${esc(x.amount)}`:''}${x.memo?`<br>메모: ${esc(x.memo)}`:''}</div>${photos?`<div class="entry-photos">${photos}</div>`:''}<div class="entry-actions"><button class="btn small secondary" onclick="editEntry(${x.id})">수정</button><button class="btn small danger" onclick="removeEntry(${x.id})">삭제</button></div></article>`
}
function openPhoto(src){document.getElementById('largePhoto').src=src;document.getElementById('photoModal').classList.add('open')}
function closePhotoModal(e){if(e&&e.target!==document.getElementById('photoModal'))return;document.getElementById('photoModal').classList.remove('open')}

async function renderJournal(){const list=await getAllEntries();renderCalendar(list);renderEntriesForDate(list)}
function renderCalendar(list){
 const counts={};list.forEach(x=>counts[x.workDate]=(counts[x.workDate]||0)+1);const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth();document.getElementById('calendarTitle').textContent=`${y}년 ${m+1}월`;
 const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),today=localDateString(new Date()),grid=document.getElementById('calendarGrid');grid.innerHTML='';
 for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=localDateString(d),b=document.createElement('button');b.className='day';b.textContent=d.getDate();if(d.getMonth()!==m)b.classList.add('other');if(key===today)b.classList.add('today');if(key===selectedCalendarDate)b.classList.add('selected');if(counts[key])b.classList.add('has-entry');b.onclick=()=>{selectedCalendarDate=key;calendarMonth=new Date(d.getFullYear(),d.getMonth(),1);renderJournal()};grid.appendChild(b)}
}
function renderEntriesForDate(list){const rows=list.filter(x=>x.workDate===selectedCalendarDate);const [y,m,d]=selectedCalendarDate.split('-').map(Number),weekday=['일','월','화','수','목','금','토'][new Date(y,m-1,d).getDay()];document.getElementById('selectedDateTitle').innerHTML=`${m}월 ${d}일 (${weekday}) <span class="entry-count">${rows.length}건</span>`;document.getElementById('entries').innerHTML=rows.length?rows.map(entryCard).join(''):'<div class="empty">이 날짜에는 저장된 작업이 없습니다.</div>'}
function changeMonth(n){calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+n,1);selectedCalendarDate=localDateString(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1));renderJournal()}
function goToday(){const d=new Date();calendarMonth=new Date(d.getFullYear(),d.getMonth(),1);selectedCalendarDate=localDateString(d);renderJournal()}

function fillSelect(id,items,label){document.getElementById(id).innerHTML=`<option value="">${label} 전체</option>`+items.map(x=>`<option>${esc(x)}</option>`).join('')}
async function runSearch(){
 const all=await getAllEntries(),from=document.getElementById('searchFrom').value,to=document.getElementById('searchTo').value,field=document.getElementById('searchField').value,work=document.getElementById('searchWork').value,worker=document.getElementById('searchWorker').value,crop=document.getElementById('searchCrop').value.trim().toLowerCase(),key=document.getElementById('searchKeyword').value.trim().toLowerCase();
 const rows=all.filter(x=>(!from||x.workDate>=from)&&(!to||x.workDate<=to)&&(!field||x.field===field)&&(!work||x.work===work)&&(!worker||x.worker===worker)&&(!crop||x.crop.toLowerCase().includes(crop))&&(!key||`${x.memo||''} ${x.amount||''}`.toLowerCase().includes(key)));
 document.getElementById('searchSummary').innerHTML=`검색 결과 <span class="entry-count">${rows.length}건</span>`;document.getElementById('searchResults').innerHTML=rows.length?rows.map(entryCard).join(''):'<div class="empty">조건에 맞는 작업기록이 없습니다.</div>'
}
function clearSearch(){['searchFrom','searchTo','searchCrop','searchKeyword'].forEach(id=>document.getElementById(id).value='');['searchField','searchWork','searchWorker'].forEach(id=>document.getElementById(id).value='');runSearch()}

function countBy(list,key){const c={};list.forEach(x=>{const v=x[key]||'미입력';c[v]=(c[v]||0)+1});return c}
function renderBars(id,obj){const el=document.getElementById(id),arr=Object.entries(obj).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...arr.map(x=>x[1]));el.innerHTML=arr.length?arr.map(([k,v])=>`<div class="stat-row"><div class="stat-label"><span>${esc(k)}</span><strong>${v}건</strong></div><div class="bar-bg"><div class="bar" style="width:${v/max*100}%"></div></div></div>`).join(''):'<div class="empty">이 달에는 기록이 없습니다.</div>'}
async function renderStats(){
 const month=document.getElementById('statsMonth').value||monthString(new Date());document.getElementById('statsMonth').value=month;const all=await getAllEntries(),list=all.filter(x=>x.workDate.startsWith(month)),days=new Set(list.map(x=>x.workDate)).size,photos=list.reduce((n,x)=>n+(x.photos||[]).length,0);
 document.getElementById('statSummary').innerHTML=`<div class="stat-box"><strong>${list.length}</strong><span>전체 작업</span></div><div class="stat-box"><strong>${days}</strong><span>작업한 날</span></div><div class="stat-box"><strong>${photos}</strong><span>저장 사진</span></div>`;
 renderBars('fieldStats',countBy(list,'field'));renderBars('cropStats',countBy(list,'crop'));renderBars('workStats',countBy(list,'work'));renderBars('workerStats',countBy(list,'worker'))
}

async function init(){
 makeChoices('fieldChoices',fields,'field');makeChoices('workChoices',works,'work');makeChoices('workerChoices',workers,'worker');fillSelect('searchField',fields,'필지');fillSelect('searchWork',works,'작업');fillSelect('searchWorker',workers,'작업자');
 document.getElementById('statsMonth').value=monthString(new Date());resetForm();updateManualControls();
 try{await openDB();await migrateOldData();await syncFromSheet()}catch(e){alert('기기 내부 데이터베이스를 열지 못했습니다. 일반 브라우저에서 다시 열어 주세요.')}
}
init();
