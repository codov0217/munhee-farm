'use strict';

let db;

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
function putEntry(x){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('entries','readwrite');
  const objectStore=tx.objectStore('entries');
  let requestError=null;
  const req=objectStore.put(x);

  req.onerror=()=>{
   requestError=req.error||new Error('기록 저장 요청 실패');
  };
  tx.oncomplete=()=>resolve(x);
  tx.onerror=()=>reject(tx.error||requestError||new Error('기록 저장 트랜잭션 오류'));
  tx.onabort=()=>reject(tx.error||requestError||new Error('기록 저장이 취소되었습니다'));
 });
}
function deleteEntryDB(id){return new Promise((res,rej)=>{const r=store('readwrite').delete(Number(id));r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
