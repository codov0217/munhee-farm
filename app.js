'use strict';

const fields=['중앙밭','계곡옆밭','과실수밭','오미자밭','수국밭','하우스밭','장독밭'];
const works=['파종','심기·정식','관수','비료','농약 방제','제초','예초','전정','수확','선별','포장','출하','장비 정비','기타'];
const workers=['아버지','어머니','본인','함께 작업'];
let selectedField='',selectedWork='',selectedWorker='',pendingPhotos=[],galleryTempPhotos=[],lastSavedEntry=null,statsGalleryPhotos=[];
let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let selectedCalendarDate=localDateString(new Date());
const DEVICE_ID_KEY='munhuiDeviceId';
function getDeviceId(){
 let id=localStorage.getItem(DEVICE_ID_KEY);
 if(!id){id='DEV-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);localStorage.setItem(DEVICE_ID_KEY,id)}
 return id;
}
function makeRecordUid(){return getDeviceId()+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}


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
 if(id==='journal')renderJournal();if(id==='search')runSearch();if(id==='stats')renderStats();if(id==='register')renderRecentWorks();window.scrollTo({top:0,behavior:'smooth'})
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
  await putEntry(entry);lastSavedEntry={...entry,photos:[]};selectedCalendarDate=workDate;const [y,m]=workDate.split('-').map(Number);calendarMonth=new Date(y,m-1,1);showToast(editId?'수정되었습니다':'저장되었습니다');resetForm();showScreen('register');document.getElementById('copyPanel').classList.add('show');renderRecentWorks()
 }catch(err){alert('저장하지 못했습니다. 휴대폰 저장공간을 확인해 주세요.')}finally{setLoading(false)}
}
async function editEntry(id){
 const x=await getEntry(id);if(!x)return;document.getElementById('editId').value=x.id;document.getElementById('formTitle').textContent='작업 수정';document.getElementById('workDate').value=x.workDate;
 document.getElementById('crop').value=x.crop;document.getElementById('amount').value=x.amount||'';document.getElementById('memo').value=x.memo||'';selectedField=x.field;selectedWork=x.work;selectedWorker=x.worker;pendingPhotos=[...(x.photos||[])];
 selectChoice('fieldChoices',x.field);selectChoice('workChoices',x.work);selectChoice('workerChoices',x.worker);renderPhotoPreview();showScreen('register')
}
async function removeEntry(id){if(!confirm('이 작업기록을 삭제할까요?'))return;await deleteEntryDB(id);showToast('삭제되었습니다');await renderJournal();if(document.getElementById('search').classList.contains('active'))runSearch();if(document.getElementById('stats').classList.contains('active'))renderStats()}

function entryCard(x){
 const photos=(Array.isArray(x.photos)?x.photos:[]).map((p,i)=>
  `<button type="button" class="photo-box" onclick="openEntryPhoto(${Number(x.id)},${i})"><img src="${esc(p)}" alt="작업 사진 ${i+1}"></button>`
 ).join('');
 return `<article class="entry"><div class="entry-top"><strong>${esc(x.field)} · ${esc(x.crop)}</strong><time>${esc(x.workDate)}</time></div><div class="meta">작업: ${esc(x.work)}<br>작업자: ${esc(x.worker)}${x.amount?`<br>작업량: ${esc(x.amount)}`:''}${x.memo?`<br>메모: ${esc(x.memo)}`:''}</div>${photos?`<div class="entry-photos">${photos}</div>`:''}<div class="entry-actions"><button class="btn small secondary" onclick="editEntry(${x.id})">수정</button><button class="btn small danger" onclick="removeEntry(${x.id})">삭제</button></div></article>`
}
async function openEntryPhoto(id,index){
 const entry=await getEntry(id);
 const src=entry&&Array.isArray(entry.photos)?entry.photos[index]:'';
 if(!src){alert('사진 데이터를 찾지 못했습니다.');return}
 document.getElementById('largePhoto').src=src;
 document.getElementById('photoModal').classList.add('open');
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


async function openStatsGallery(){
 const month=document.getElementById('statsMonth').value||monthString(new Date());
 const all=await getAllEntries();
 const monthEntries=all.filter(x=>String(x.workDate||'').startsWith(month));
 statsGalleryPhotos=[];
 monthEntries.forEach(entry=>{
  (Array.isArray(entry.photos)?entry.photos:[]).forEach((src,index)=>{
   if(src)statsGalleryPhotos.push({
    src,
    entryId:Number(entry.id),
    photoIndex:index,
    workDate:entry.workDate||'',
    field:entry.field||'',
    crop:entry.crop||''
   });
  });
 });

 const [year,monthNumber]=month.split('-').map(Number);
 document.getElementById('statsGalleryTitle').textContent=`${year}년 ${monthNumber}월 저장 사진`;
 document.getElementById('statsGalleryCount').textContent=`총 ${statsGalleryPhotos.length}장`;

 const grid=document.getElementById('statsGalleryGrid');
 if(!statsGalleryPhotos.length){
  grid.innerHTML='<div class="empty stats-gallery-empty">이 달에 저장된 사진이 없습니다.</div>';
 }else{
  grid.innerHTML=statsGalleryPhotos.map((photo,index)=>`
   <button type="button" class="stats-gallery-item" onclick="openStatsPhoto(${index})">
    <img src="${esc(photo.src)}" alt="${esc(photo.workDate)} ${esc(photo.field)} 작업 사진">
    <span>${esc(photo.workDate.slice(5))}<br>${esc(photo.field)} · ${esc(photo.crop)}</span>
   </button>`).join('');
 }
 document.getElementById('statsGallery').classList.add('open');
 document.body.style.overflow='hidden';
}

function closeStatsGallery(){
 document.getElementById('statsGallery').classList.remove('open');
 document.body.style.overflow='';
}

function openStatsPhoto(index){
 const photo=statsGalleryPhotos[index];
 if(!photo||!photo.src){alert('사진 데이터를 찾지 못했습니다.');return}
 document.getElementById('largePhoto').src=photo.src;
 document.getElementById('photoModal').classList.add('open');
}

async function openWorkedDaysCalendar(){
 const month=document.getElementById('statsMonth').value||monthString(new Date());
 const all=await getAllEntries();
 const monthEntries=all
  .filter(x=>String(x.workDate||'').startsWith(month))
  .sort((a,b)=>String(a.workDate).localeCompare(String(b.workDate)));

 const [year,monthNumber]=month.split('-').map(Number);
 calendarMonth=new Date(year,monthNumber-1,1);
 selectedCalendarDate=monthEntries.length?monthEntries[0].workDate:`${month}-01`;
 showScreen('journal');
}

function countBy(list,key){const c={};list.forEach(x=>{const v=x[key]||'미입력';c[v]=(c[v]||0)+1});return c}
function renderBars(id,obj){const el=document.getElementById(id),arr=Object.entries(obj).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...arr.map(x=>x[1]));el.innerHTML=arr.length?arr.map(([k,v])=>`<div class="stat-row"><div class="stat-label"><span>${esc(k)}</span><strong>${v}건</strong></div><div class="bar-bg"><div class="bar" style="width:${v/max*100}%"></div></div></div>`).join(''):'<div class="empty">이 달에는 기록이 없습니다.</div>'}
async function renderStats(){
 const month=document.getElementById('statsMonth').value||monthString(new Date());document.getElementById('statsMonth').value=month;const all=await getAllEntries(),list=all.filter(x=>x.workDate.startsWith(month)),days=new Set(list.map(x=>x.workDate)).size,photos=list.reduce((n,x)=>n+(x.photos||[]).length,0);
 document.getElementById('statSummary').innerHTML=`
  <div class="stat-box"><strong>${list.length}</strong><span>전체 작업</span></div>
  <button type="button" class="stat-box stat-link" onclick="openWorkedDaysCalendar()" aria-label="작업한 날을 달력에서 보기">
   <strong>${days}</strong><span>작업한 날</span><small>달력에서 보기</small>
  </button>
  <button type="button" class="stat-box stat-link" onclick="openStatsGallery()" aria-label="저장 사진을 갤러리로 보기">
   <strong>${photos}</strong><span>저장 사진</span><small>사진 모아보기</small>
  </button>`;
 renderBars('fieldStats',countBy(list,'field'));renderBars('cropStats',countBy(list,'crop'));renderBars('workStats',countBy(list,'work'));renderBars('workerStats',countBy(list,'worker'))
}

async function init(){
 makeChoices('fieldChoices',fields,'field');makeChoices('workChoices',works,'work');makeChoices('workerChoices',workers,'worker');fillSelect('searchField',fields,'필지');fillSelect('searchWork',works,'작업');fillSelect('searchWorker',workers,'작업자');
 document.getElementById('statsMonth').value=monthString(new Date());resetForm();
 try{await openDB();await migrateOldData()}catch(e){alert('기기 내부 데이터베이스를 열지 못했습니다. 일반 브라우저에서 다시 열어 주세요.')}
}
init();

async function buildBackupPayload(){
 const entries=await getAllEntries();
 return {
  app:'문희농원 작업일지',version:'2.8',exportedAt:new Date().toISOString(),deviceId:getDeviceId(),
  entries:entries.map(x=>({...x,recordUid:x.recordUid||('LEGACY-'+(x.deviceId||getDeviceId())+'-'+x.id),deviceId:x.deviceId||getDeviceId()})),
  favorites:getFavorites()
 };
}
function backupFilename(){
 const d=new Date(),pad=n=>String(n).padStart(2,'0');
 return `문희농원_가족데이터_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}.json`;
}
function downloadDataFile(json,filename){
 const blob=new Blob([json],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download=filename;a.style.display='none';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function shareBackup(){
 let payload=null,json='',filename='';
 try{
  setLoading(true);
  payload=await buildBackupPayload();
  json=JSON.stringify(payload);
  filename=backupFilename();

  if(window.AndroidShare&&typeof window.AndroidShare.shareJson==='function'){
   window.AndroidShare.shareJson(json,filename);
   showToast(`작업 ${payload.entries.length}건 공유 화면을 엽니다`);
   return;
  }

  const file=new File([json],filename,{type:'application/json'});
  const canShareFile=!!(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}));
  if(canShareFile){
   try{
    await navigator.share({title:'문희농원 작업일지 데이터',text:'가족 작업일지 취합용 데이터입니다.',files:[file]});
    return;
   }catch(shareErr){
    if(shareErr&&shareErr.name==='AbortError')return;
    console.warn('파일 직접 공유 실패, 다운로드로 전환',shareErr);
   }
  }

  downloadDataFile(json,filename);
  alert('카카오톡 직접 공유가 지원되지 않아 데이터 파일을 저장했습니다.\n\n카카오톡 → + 버튼 → 파일에서 방금 저장한 문희농원 파일을 선택해 보내주세요.');
 }catch(err){
  console.error(err);
  if(json&&filename){
   try{downloadDataFile(json,filename);alert('직접 공유 대신 데이터 파일을 저장했습니다. 카카오톡에서 파일로 첨부해 주세요.');return}catch(e){}
  }
  alert('데이터 파일을 만드는 중 문제가 발생했습니다.');
 }finally{setLoading(false)}
}

async function exportBackup(){
 try{
  setLoading(true);
  const payload=await buildBackupPayload();
  const entries=payload.entries;
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  a.href=url;
  a.download=`문희농원_작업일지_백업_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`작업 ${entries.length}건을 백업했습니다`);
 }catch(err){
  console.error(err);
  alert('백업 파일을 만드는 중 문제가 발생했습니다.');
 }finally{
  setLoading(false);
 }
}

function normalizeBackupPhoto(value){
 if(typeof value!=='string')return '';
 const photo=value.trim();
 if(!photo)return '';
 if(/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(photo))return photo.replace(/\s+/g,'');
 return '';
}
function normalizeBackupEntry(item,index,data){
 if(!item||typeof item!=='object')throw new Error(`${index+1}번째 기록의 내용이 없습니다.`);
 const sourceId=item.id??(`ROW-${index}`);
 const sourceDevice=String(item.deviceId||data?.deviceId||'IMPORT');
 const uid=String(item.recordUid||(`LEGACY-${sourceDevice}-${sourceId}`));
 const photos=(Array.isArray(item.photos)?item.photos:[]).map(normalizeBackupPhoto).filter(Boolean).slice(0,3);
 const entry={
  ...item,
  recordUid:uid,
  deviceId:sourceDevice,
  workDate:String(item.workDate||''),
  field:String(item.field||''),
  crop:String(item.crop||''),
  work:String(item.work||''),
  worker:String(item.worker||''),
  amount:String(item.amount||''),
  memo:String(item.memo||''),
  photos,
  createdAt:item.createdAt||new Date().toISOString(),
  updatedAt:item.updatedAt||item.createdAt||new Date().toISOString()
 };
 if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.workDate))throw new Error(`${index+1}번째 기록의 작업 날짜가 잘못되었습니다.`);
 return entry;
}
function sameEntryContent(a,b){
 const keys=['workDate','field','crop','work','worker','amount','memo'];
 if(!keys.every(k=>String(a?.[k]||'')===String(b?.[k]||'')))return false;
 const ap=Array.isArray(a?.photos)?a.photos:[];
 const bp=Array.isArray(b?.photos)?b.photos:[];
 return ap.length===bp.length&&ap.every((v,i)=>v===bp[i]);
}
function verifySavedEntry(saved,expected){
 if(!saved)return false;
 if(String(saved.recordUid)!==String(expected.recordUid))return false;
 if(!sameEntryContent(saved,expected))return false;
 return true;
}
async function importBackup(event){
 const input=event.target;
 const file=input.files&&input.files[0];
 if(!file)return;
 let stage='파일 읽기';
 try{
  setLoading(true);
  const raw=await file.text();
  stage='파일 내용 확인';
  let data;
  try{data=JSON.parse(raw.replace(/^\uFEFF/,'').trim())}catch(_){throw new Error('JSON_PARSE')}
  const entries=Array.isArray(data)?data:(Array.isArray(data?.entries)?data.entries:(Array.isArray(data?.data)?data.data:null));
  if(!entries)throw new Error('NO_ENTRIES');
  if(typeof data?.app==='string'&&data.app&&data.app!=='문희농원 작업일지')throw new Error('WRONG_APP');

  const normalized=[];
  const invalid=[];
  entries.forEach((item,index)=>{
   try{normalized.push(normalizeBackupEntry(item,index,data))}
   catch(err){invalid.push(err.message)}
  });
  const sourcePhotoCount=normalized.reduce((n,x)=>n+x.photos.length,0);
  if(!normalized.length)throw new Error(invalid[0]||'NO_VALID_ENTRIES');

  const ok=confirm(
   `백업 작업 ${normalized.length}건 · 사진 ${sourcePhotoCount}장이 확인되었습니다.\n`+
   `현재 데이터에 합칠까요?\n\n`+
   `같은 기록도 내용이나 사진이 빠져 있으면 원본으로 복구합니다.`
  );
  if(!ok)return;

  stage='기존 데이터 확인';
  const current=await getAllEntries();
  const byUid=new Map(current.map(x=>[String(x.recordUid||(`LEGACY-${x.deviceId||'OLD'}-${x.id}`)),x]));
  const usedIds=new Set(current.map(x=>Number(x.id)).filter(Number.isFinite));
  const nextUniqueId=()=>{let id=Date.now();while(usedIds.has(id))id++;usedIds.add(id);return id};

  let added=0,repaired=0,identical=0,failed=0;
  let savedPhotoCount=0;
  const failures=[];
  const importedIds=[];

  stage='작업과 사진 저장';
  for(const incoming of normalized){
   const existing=byUid.get(incoming.recordUid);
   const copy={...incoming,id:existing?Number(existing.id):nextUniqueId()};
   try{
    if(existing&&sameEntryContent(existing,copy)){
     identical++;
     importedIds.push(Number(existing.id));
     savedPhotoCount+=(Array.isArray(existing.photos)?existing.photos.length:0);
     continue;
    }
    await putEntry(copy);
    const saved=await getEntry(copy.id);
    if(!verifySavedEntry(saved,copy))throw new Error('저장 후 검증 실패');
    byUid.set(copy.recordUid,saved);
    importedIds.push(Number(saved.id));
    savedPhotoCount+=(Array.isArray(saved.photos)?saved.photos.length:0);
    if(existing)repaired++;else added++;
   }catch(err){
    failed++;
    failures.push(`${copy.workDate} ${copy.field||''} ${copy.crop||''}: ${err.message||err}`);
   }
  }

  stage='즐겨찾기 합치기';
  if(Array.isArray(data?.favorites)){
   const merged=[...getFavorites()];
   for(const fav of data.favorites){
    if(!fav||typeof fav!=='object')continue;
    if(!merged.some(x=>(fav.signature&&x.signature===fav.signature)))merged.push(fav);
   }
   saveFavorites(merged);
  }

  stage='최종 저장 확인';
  const finalEntries=await getAllEntries();
  const imported=finalEntries.filter(x=>importedIds.includes(Number(x.id)));
  const finalPhotoCount=imported.reduce((n,x)=>n+(Array.isArray(x.photos)?x.photos.length:0),0);
  const first=imported.sort((a,b)=>String(a.workDate).localeCompare(String(b.workDate)))[0];
  if(first){
   selectedCalendarDate=first.workDate;
   const [y,m]=first.workDate.split('-').map(Number);
   calendarMonth=new Date(y,m-1,1);
  }

  await renderRecentWorks();
  if(first){
   showScreen('journal');
   await renderJournal();
  }
  if(document.getElementById('search')?.classList.contains('active'))await runSearch();
  if(document.getElementById('stats')?.classList.contains('active'))await renderStats();

  const result=
   `합치기 완료\n\n`+
   `새 작업: ${added}건\n`+
   `기존 기록 복구: ${repaired}건\n`+
   `완전히 같은 기록: ${identical}건\n`+
   `저장 확인된 사진: ${finalPhotoCount}장`+
   (failed?`\n저장 실패: ${failed}건`:'')+
   (first?`\n\n${first.workDate}의 기록 화면을 열었습니다.`:'');
  alert(result);
  showToast(`작업 ${added+repaired}건 반영 · 사진 ${finalPhotoCount}장 확인`);
  if(failed)alert(`저장하지 못한 기록이 있습니다.\n\n${failures.slice(0,5).join('\n')}`);
  if(sourcePhotoCount!==savedPhotoCount&&failed===0){
   console.warn('백업 사진 수와 확인 사진 수 차이', {sourcePhotoCount,savedPhotoCount,finalPhotoCount});
  }
 }catch(err){
  console.error('백업 합치기 실패 단계:',stage,err);
  const messages={JSON_PARSE:'파일 내용이 JSON 형식이 아닙니다.',NO_ENTRIES:'백업파일에서 작업 목록을 찾지 못했습니다.',WRONG_APP:'문희농원 작업일지 백업파일이 아닙니다.'};
  alert(`데이터 합치기에 실패했습니다.\n\n단계: ${stage}\n이유: ${messages[err.message]||err.message||'알 수 없는 오류'}`);
 }finally{
  input.value='';
  setLoading(false);
 }
}

