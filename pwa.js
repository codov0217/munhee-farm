'use strict';

let deferredInstallPrompt=null;
let waitingWorker=null;
const installBanner=document.getElementById('installBanner');
const installButton=document.getElementById('installButton');

window.addEventListener('beforeinstallprompt',(event)=>{
 event.preventDefault();
 deferredInstallPrompt=event;
 installBanner?.classList.add('show');
});
installButton?.addEventListener('click',async()=>{
 if(deferredInstallPrompt){
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  installBanner.classList.remove('show');
 }else{
  alert('크롬 오른쪽 위 메뉴(⋮)에서 “앱 설치” 또는 “홈 화면에 추가”를 눌러주세요.');
 }
});
window.addEventListener('appinstalled',()=>installBanner?.classList.remove('show'));

function showUpdateBanner(worker){
 waitingWorker=worker||waitingWorker;
 document.getElementById('updateBanner')?.classList.add('show');
}

if('serviceWorker' in navigator){
 window.addEventListener('load',async()=>{
  try{
   const registration=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});

   // 앱을 열 때마다 GitHub의 최신 파일을 확인합니다.
   await registration.update();
   if(registration.waiting) showUpdateBanner(registration.waiting);

   registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;
    worker?.addEventListener('statechange',()=>{
     if(worker.state==='installed' && navigator.serviceWorker.controller){
      showUpdateBanner(worker);
     }
    });
   });

   // 앱이 다시 화면에 나타날 때도 최신 버전을 확인합니다.
   document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') registration.update();
   });
   window.addEventListener('focus',()=>registration.update());

   // 앱을 오래 켜둔 경우 15분마다 확인합니다.
   setInterval(()=>registration.update(),15*60*1000);
  }catch(err){console.warn('서비스 워커 등록 실패',err)}
 });

 let refreshing=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(refreshing)return;
  refreshing=true;
  location.reload();
 });
}

function applyUpdate(){
 const button=document.getElementById('updateButton');
 if(button){button.disabled=true;button.textContent='적용 중…';}
 if(waitingWorker){
  waitingWorker.postMessage({type:'SKIP_WAITING'});
 }else{
  location.reload();
 }
}
