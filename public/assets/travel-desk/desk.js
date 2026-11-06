export async function mount(root,data,signal,navigate){const escape=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
if(navigate)root.addEventListener("click",event=>{const link=event.target.closest?.("a[href]");if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute("download")||(link.target&&link.target!=="_self"))return;const url=new URL(link.href,location.href);if(url.origin===location.origin&&/^https?:$/.test(url.protocol)&&navigate(url.pathname+url.search+url.hash))event.preventDefault();},{signal});
const $=id=>root.getElementById(id);const lifetime=new AbortController();const listen=(target,name,fn)=>target.addEventListener(name,fn,{signal:lifetime.signal});let photos=data.photos.map((p,index)=>({...p,number:index+1,city:p.title,file:p.src})),favorites=new Set(photos.map(p=>p.id)),city="全部",current=photos[0]?.id,timer;
const rail=$('carousel');function list(){return photos.filter(p=>favorites.has(p.id)&&(city==='全部'||p.city===city))}let group=0;const perPage=()=>innerWidth<=650?3:innerWidth<=1000?4:6;function render(){const items=list(),size=perPage();root.querySelector(".memory-strip").classList.toggle("is-empty",items.length===0);group=Math.min(group,Math.max(0,Math.ceil(items.length/size)-1));rail.innerHTML=items.length?items.map(p=>`<article class="photo"><img loading="lazy" decoding="async" draggable="false" role="button" tabindex="0" data-open="${p.id}" src="${p.src}" alt="${escape(p.title)}"><button class="heart" data-heart="${p.id}" aria-label="取消收藏${escape(p.title)}" aria-pressed="true">♥</button><div class="caption"><span>${escape(p.title)}</span><small>${String(p.number).padStart(2,'0')}</small></div></article>`).join(''):'<div class="empty">暂无收藏</div>';$('total').textContent=favorites.size;$('picks').innerHTML='';$('counter').textContent=`${items.length?group+1:0} / ${Math.ceil(items.length/size)}`;$('back').disabled=group===0;$('forward').disabled=(group+1)*size>=items.length;updateHeart();requestAnimationFrame(scrollState)}function move(dir){rail.scrollBy({left:dir*rail.clientWidth,behavior:"smooth"})}$('back').onclick=()=>move(-1);$('forward').onclick=()=>move(1);let lastSize=perPage();listen(window,'resize',()=>{if(lastSize!==perPage()){lastSize=perPage();group=0;render()}});rail.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1)}};let drag=null,suppress=false;function scrollState(){if(lifetime.signal.aborted)return;const overflow=rail.scrollWidth>rail.clientWidth+2;root.querySelector(".pager").hidden=!overflow;const total=list().length;group=Math.max(0,Math.round(rail.scrollLeft/Math.max(1,rail.clientWidth)));$("counter").textContent=`${total?group+1:0} / ${Math.ceil(total/perPage())}`;$("back").disabled=rail.scrollLeft<2;$("forward").disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2;}const railObserver=typeof ResizeObserver==="function"?new ResizeObserver(scrollState):null;railObserver?.observe(rail);listen(window,"resize",scrollState);listen(rail,"scroll",scrollState);rail.addEventListener("dragstart",e=>e.preventDefault());listen(rail,"pointerdown",e=>{if(e.pointerType!=="mouse"||e.button!==0)return;drag={x:e.clientX,y:e.clientY,scroll:rail.scrollLeft,active:false};suppress=false});listen(rail,"pointermove",e=>{if(!drag)return;const dx=e.clientX-drag.x;if(!drag.active&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(e.clientY-drag.y)){drag.active=true;suppress=true;rail.style.scrollSnapType="none";rail.setPointerCapture(e.pointerId)}if(drag.active){e.preventDefault();rail.scrollLeft=drag.scroll-dx}});listen(window,"pointerup",e=>{drag=null;rail.style.scrollSnapType="";if(rail.hasPointerCapture(e.pointerId))rail.releasePointerCapture(e.pointerId);setTimeout(()=>suppress=false,100)});listen(window,"pointercancel",()=>{drag=null;suppress=false;rail.style.scrollSnapType=""});
const saving=new Set();function notice(text){clearTimeout(timer);$('toast').textContent=text;$('toast').hidden=false;timer=setTimeout(()=>$('toast').hidden=true,4500)}async function toggle(id){if(saving.has(id))return;const p=photos.find(p=>p.id===id);if(!p)return;saving.add(id);const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(`/api/albums/${encodeURIComponent(p.albumId)}/media/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({isFavorite:!favorites.has(id)}),signal:AbortSignal.any([controller.signal,lifetime.signal])});if(lifetime.signal.aborted)return;if(!response.ok)throw new Error();if(favorites.has(id))favorites.delete(id);else favorites.add(id);render();notice(favorites.has(id)?'已收藏':'已取消收藏');}catch{if(!lifetime.signal.aborted)notice('收藏更新失败，请重试');}finally{clearTimeout(timeout);saving.delete(id)}}function updateHeart(){$('light-heart').textContent=favorites.has(current)?'♥ 已收藏':'♡ 收藏';$('light-heart').setAttribute('aria-pressed',String(favorites.has(current)))}function open(id){current=id;const p=photos.find(x=>x.id===id);$('light-title').textContent=p.title;$('light-img').src=p.full;$('light-img').alt=p.title;$('location').textContent='收藏瞬间';updateHeart();$('lightbox').showModal()}listen(root,'click',e=>{const h=e.target.closest('[data-heart]');if(h&&!suppress)toggle(h.dataset.heart);const o=e.target.closest('[data-open]');if(o&&!suppress)open(o.dataset.open);if(e.target.closest('.close'))e.target.closest('dialog').close()});listen(root,'keydown',e=>{if(e.target.matches('[data-open]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open(e.target.dataset.open)}});$('light-heart').onclick=()=>toggle(current);root.querySelectorAll('[data-city]').forEach(b=>b.onclick=()=>{city=b.dataset.city;root.querySelectorAll('[data-city]').forEach(x=>x.classList.toggle('active',x===b));render()});root.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}));
const audio = $("audio");
const disc = $("disc");
const trackToggle = $("track-toggle");
const trackList = $("track-list");
const tracks = [
  { title: "音乐 01", file: "track-01-web.mp3" },
  { title: "音乐 02", file: "track-02-web.mp3" },
];
audio.volume = .3;
let track = 0;
let playRequest = 0;
let discClick;
let awaitingGesture = false;
const musicPauseKey = "trip-home-music-paused";
let manuallyPaused = false;
try {
  manuallyPaused = sessionStorage.getItem(musicPauseKey) === "true";
} catch { /* Playback is still available without session storage. */ }

function rememberPause(paused) {
  manuallyPaused = paused;
  try {
    sessionStorage.setItem(musicPauseKey, String(paused));
  } catch { /* Keep the preference for this visit. */ }
}

function musicState() {
  const playing = !audio.paused;
  $("turntable").classList.toggle("on", playing);
  disc.setAttribute("aria-label", playing ? "暂停音乐" : "播放音乐");
}

async function play() {
  awaitingGesture = false;
  if (!audio.getAttribute("src")) audio.src = "/assets/travel-desk/music/" + tracks[track].file;
  const request = ++playRequest;
  $("audio-status").textContent = "";
  try {
    await audio.play();
  } catch (error) {
    if (request !== playRequest) return;
    if (error.name === "NotAllowedError") {
      awaitingGesture = !manuallyPaused;
    } else if (error.name !== "AbortError") {
      $("audio-status").textContent = "播放失败，请重试";
    }
  }
}

function togglePlay() {
  if (audio.paused) {
    rememberPause(false);
    play();
  }
  else {
    rememberPause(true);
    playRequest++;
    audio.pause();
  }
}

function clearDiscClick() {
  clearTimeout(discClick);
  discClick = undefined;
}

function selectTrack(index) {
  clearDiscClick();
  if (track !== index) {
    playRequest++;
    audio.pause();
    track = index;
    audio.removeAttribute("src");
  }
  trackButtons.forEach((button, i) => {
    if (i === track) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  play();
}

function nextTrack() {
  selectTrack((track + 1) % tracks.length);
}

function setTrackList(open, restoreFocus = false) {
  trackList.hidden = !open;
  trackToggle.setAttribute("aria-expanded", String(open));
  if (restoreFocus) trackToggle.focus();
}

const trackButtons = tracks.map(({ title }, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = title;
  if (index === track) button.setAttribute("aria-current", "true");
  listen(button, "click", () => {
    rememberPause(false);
    selectTrack(index);
    setTrackList(false, true);
  });
  trackList.append(button);
  return button;
});

listen(disc, "click", event => {
  if (event.detail === 0) {
    clearDiscClick();
    togglePlay();
    return;
  }
  if (discClick !== undefined) {
    rememberPause(false);
    nextTrack();
    return;
  }
  if (audio.paused) {
    togglePlay();
    discClick = setTimeout(clearDiscClick, 320);
    return;
  }
  discClick = setTimeout(() => {
    discClick = undefined;
    togglePlay();
  }, 320);
});
listen(document, "click", event => {
  if (!awaitingGesture || manuallyPaused || !event.isTrusted) return;
  const path = event.composedPath();
  if (path.includes(disc) || trackButtons.some(button => path.includes(button))) return;
  play();
});
listen(trackToggle, "click", () => setTrackList(trackList.hidden));
listen(document, "pointerdown", event => {
  const path = event.composedPath();
  if (!trackList.hidden && !path.includes(trackList) && !path.includes(trackToggle)) {
    setTrackList(false);
  }
});
listen(root, "keydown", event => {
  if (event.key === "Escape" && !trackList.hidden) {
    event.preventDefault();
    event.stopPropagation();
    setTrackList(false, true);
  }
});
audio.onplay = musicState;
audio.onpause = musicState;
audio.onended = nextTrack;
audio.onerror = () => {
  $("audio-status").textContent = "音乐载入失败，请重试";
  audio.removeAttribute("src");
  musicState();
};
render();
if (!manuallyPaused) play();
const stateKey=data.memberId?"trip-home-book:"+data.memberId:null;let restored;try{const saved=stateKey?JSON.parse(sessionStorage.getItem(stateKey)):null;if(saved&&saved.open===true&&Number.isInteger(saved.page)&&saved.page>=1&&saved.page<=3)restored={open:true,page:saved.page};}catch{/* Storage unavailable: keep normal opening behavior. */}
const chapterObserver=new MutationObserver(()=>{const links=$("scene-links");if(!links)return;const page=$("scene-wrap").dataset.page;const state=$("scene-wrap").dataset.state;if(stateKey&&(state==="open"||state==="closed")){try{sessionStorage.setItem(stateKey,JSON.stringify({open:state==="open",page:Number(page)}))}catch{/* Navigation works without storage. */}}const items=$("scene-wrap").dataset.state!=="open"?[]:page==="2"?data.trips:page==="3"?data.albums:[];links.replaceChildren();items.slice(0,2).forEach(item=>{const a=document.createElement("a");a.href=item.href;a.textContent=item.title;links.append(a)});});chapterObserver.observe($("scene-wrap"),{attributes:true,attributeFilter:["data-page","data-state"]});let sceneCleanup,sceneLoading;
const sceneWrap=$("scene-wrap"),openButton=$("scene-open");sceneWrap.tabIndex=0;
let preparedScene, warmIdle=0;
function prepareScene(){
 if(!preparedScene)preparedScene=import("./scene.js?v=navigation-20261106").catch(error=>{preparedScene=null;throw error});
 return preparedScene;
}
const warmScene=()=>{if(!document.hidden)void prepareScene().catch(()=>{});};
sceneWrap.addEventListener("pointerenter",warmScene,{once:true,signal:lifetime.signal});
sceneWrap.addEventListener("focusin",warmScene,{once:true,signal:lifetime.signal});
const warmWhenIdle=()=>{
 if(navigator.connection?.saveData||/2g/.test(navigator.connection?.effectiveType||""))return;
 if("requestIdleCallback" in window)warmIdle=requestIdleCallback(warmScene,{timeout:2000});
};
if(document.readyState==="complete")warmWhenIdle();else window.addEventListener("load",warmWhenIdle,{once:true,signal:lifetime.signal});
async function loadScene(openOnMount){
 if(sceneLoading)return sceneLoading;
 sceneLoading=(async()=>{openButton.disabled=true;openButton.textContent="正在打开…";sceneWrap.dataset.state="loading";let timeout;
 try{const sceneModule=await Promise.race([prepareScene(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error("BOOK_LOAD_TIMEOUT")),15000)})]);if(signal?.aborted||lifetime.signal.aborted)return;$("scene-canvas").onclick=null;sceneWrap.onkeydown=null;sceneCleanup=sceneModule.mountScene(root,data,restored,openOnMount,navigate);openButton.textContent="翻开旅行手记 ↗";}
 catch(error){if(!lifetime.signal.aborted){sceneLoading=null;openButton.disabled=false;const timedOut=error?.message==="BOOK_LOAD_TIMEOUT";openButton.textContent=timedOut?"重试打开旅行书":"重新加载";openButton.onclick=timedOut?()=>void loadScene(true):()=>location.reload();sceneWrap.dataset.state="closed";notice("立体书暂时无法打开，请重试或使用网站导航。");}}
 finally{clearTimeout(timeout)}
 })();return sceneLoading;
}
openButton.onclick=()=>void loadScene(true);$("scene-canvas").onclick=()=>void loadScene(true);
sceneWrap.onkeydown=e=>{if(e.target.closest("button,a,input"))return;if(e.key==="Enter"||e.key===" "){e.preventDefault();void loadScene(true)}};
if(restored)void loadScene(false);else sceneWrap.dataset.state="closed";

return ()=>{if(warmIdle)cancelIdleCallback(warmIdle);railObserver?.disconnect();lifetime.abort();chapterObserver.disconnect();clearTimeout(timer);clearDiscClick();playRequest++;audio.onplay=audio.onpause=audio.onended=audio.onerror=null;audio.pause();audio.removeAttribute("src");audio.load();sceneCleanup?.();root.querySelectorAll("dialog[open]").forEach(d=>d.close());};
}
