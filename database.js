'use strict';

let db;
function openDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open('munhuiFarmDB',3);
  req.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('entries')){const s=d.createObjectStore('entries',{keyPath:'id'});s.createIndex('workDate','workDate',{unique:false})}};
  req.onsuccess=e=>{db=e.target.result;resolve(db)};req.onerror=()=>reject(req.error);
 })
}
function store(mode='readonly'){return db.transaction('entries',mode).objectStore('entries')}
function getAllEntries(){return new Promise((res,rej)=>{const r=store().getAll();r.onsuccess=()=>res(r.result.sort((a,b)=>(b.workDate+a.createdAt).localeCompare(a.workDate+a.createdAt)));r.onerror=()=>rej(r.error)})}
function getEntry(id){return new Promise((res,rej)=>{const r=store().get(Number(id));r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function putEntry(x){return new Promise((res,rej)=>{const r=store('readwrite').put(x);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function deleteEntryDB(id){return new Promise((res,rej)=>{const r=store('readwrite').delete(Number(id));r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
// 예전 버전이 사진을 data: URL로 통째로 저장해 둔 경우만 정리한다.
// 드라이브 링크(https)는 그대로 유지된다.
function purgeLocalPhotoData(){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('entries','readwrite');
  const s=tx.objectStore('entries');
  const r=s.openCursor(); let cleared=0;
  r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{
   const cursor=r.result;
   if(!cursor)return;
   const entry=cursor.value;
   const photos=Array.isArray(entry.photos)?entry.photos:[];
   const remote=photos.filter(photo=>typeof photo==='string'&&/^https:\/\//.test(photo));
   if(remote.length!==photos.length){cursor.update({...entry,photos:remote});cleared++;}
   cursor.continue();
  };
  tx.oncomplete=()=>resolve(cleared);
  tx.onerror=()=>reject(tx.error);
 });
}
