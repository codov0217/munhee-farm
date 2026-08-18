'use strict';

function loadCalendarWeatherModule(){
  if(document.querySelector('script[data-munhui-calendar-weather]'))return;
  const script=document.createElement('script');
  script.src='./calendar-weather.js?v=20260818';
  script.dataset.munhuiCalendarWeather='true';
  script.onload=()=>console.log('완장리 달력 날씨 모듈 연결됨');
  script.onerror=()=>console.warn('calendar-weather.js를 불러오지 못했습니다.');
  document.head.appendChild(script);
}
loadCalendarWeatherModule();

let deferredInstallPrompt=null;
let waitingWorker=null;
const installBanner=document.getElementById('installBanner');
const installButton=document.getElementById('installButton');
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;installBanner?.classList.add('show')});
installButton?.addEventListener('click',async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;installBanner?.classList.remove('show')}else{alert('크롬 메뉴(⋮)에서 “앱 설치” 또는 “홈 화면에 추가”를 눌러주세요.')}});
window.addEventListener('appinstalled',()=>installBanner?.classList.remove('show'));
function showUpdateBanner(worker){waitingWorker=worker||waitingWorker;document.getElementById('updateBanner')?.classList.add('show')}
if('serviceWorker' in navigator){window.addEventListener('load',async()=>{try{const registration=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});await registration.update();if(registration.waiting)showUpdateBanner(registration.waiting);registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdateBanner(worker)})});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')registration.update()});window.addEventListener('focus',()=>registration.update());setInterval(()=>registration.update(),15*60*1000)}catch(err){console.warn('서비스 워커 등록 실패',err)}});let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)return;refreshing=true;location.reload()})}
function applyUpdate(){const button=document.getElementById('updateButton');if(button){button.disabled=true;button.textContent='적용 중…'}if(waitingWorker)waitingWorker.postMessage({type:'SKIP_WAITING'});else location.reload()}
