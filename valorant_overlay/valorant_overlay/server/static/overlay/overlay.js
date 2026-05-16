// overlay.js - maps server state to DOM
const STATE_URL = '/api/state';
let currentState = null;



function qs(id){ return document.getElementById(id); }
function setTxt(id, v){ const el = qs(id); if(!el) return; el.textContent = v==null?'':String(v); }
function setImg(id, url){
  const el = qs(id);
  if(!el) return; 
  if(url){
    el.src = url;
    el.style.display = '';
  } else {
    el.src = 'assets/placeholder.png';
  }
}

// Apply a normalized state object
function applyState(state){
  if (!state) return;
  currentState = state;

  const left  = state.left  || {};
  const right = state.right || {};
  const live  = state.live  || {};

  const leftScore  = left.score  != null ? Number(left.score)  : 0;
  const rightScore = right.score != null ? Number(right.score) : 0;

  // round to show - explicit round if present, else auto from scores
  const roundToShow =
    live.round != null && live.round !== ''
      ? Number(live.round)
      : leftScore + rightScore + 1;

  // flip background image based on flag from control panel
  const flipped = !!live.sidesFlipped;
  const bg = document.getElementById('scoreboard-bg');
  if (bg) {
    bg.src = flipped
      ? 'Valorant_scoreboard2.png'
      : 'Valorant_scoreboard1.png';
  }

  // left side
  setTxt('LTN', left.name || 'TEAM LEFT');
  setTxt('LS',  left.score != null ? left.score : 0);
  setTxt('LTS', left.seed ? `SEED ${left.seed}` : '');
  setImg('LL',  left.logo || left.logoSrc || 'logo-left.png');

  // right side
  setTxt('RTN', right.name || 'TEAM RIGHT');
  setTxt('RS',  right.score != null ? right.score : 0);
  setTxt('RTS', right.seed ? `SEED ${right.seed}` : '');
  setImg('RL',  right.logo || right.logoSrc || 'logo-right.png');

  // center label and round number
  setTxt('CL', 'ROUND');
  setTxt('CR', roundToShow);
}




// Polling fallback
async function fetchStateOnce(){
  try {
    const res = await fetch(STATE_URL, {cache:'no-store'});
    if(!res.ok) return;
    const data = await res.json();
    const st = data.state || data;
    applyState(st);
  } catch(e){}
}

// Try WebSocket first
function startWS(){
  try {
    const wsHost = location.host || `${location.hostname}:25565`;
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProto}//${wsHost}`);

    // optional: expose ws for debugging in browser console
    window.overlayWS = ws;

    ws.onmessage = (msg) => {
      try {
        const d = JSON.parse(msg.data);
        console.log('overlay: ws message', d);

        if (d.type === 'state' && d.state) {
          const st = d.state;

          // timer and flags from live data
          if (st.live) {
            const live = st.live;
            const timer = live.timer || '';
            const spikeActive = !!live.spikeActive;
            const timeoutActive = !!live.timeoutActive;

            if (timeoutActive) {
              showTimeoutTimer(timer);
            } else if (spikeActive) {
              showSpikeTimer(timer);
            } else {
              showRoundTimer(timer);
            }
          }

          applyState(st);
        } else if (d.state) {
          const st = d.state;

          if (st.live) {
            const live = st.live;
            const timer = live.timer || '';
            const spikeActive = !!live.spikeActive;
            const timeoutActive = !!live.timeoutActive;

            if (timeoutActive) {
              showTimeoutTimer(timer);
            } else if (spikeActive) {
              showSpikeTimer(timer);
            } else {
              showRoundTimer(timer);
            }
          }

          applyState(st);
        }
      } catch (e) {
        console.error('overlay: ws message parse error', e);
      }
    };


    ws.onopen = ()=> {
      console.log("overlay: ws connected");
    };
    ws.onclose = ()=> {
      console.log("overlay: ws closed - switching to polling mode");
      startPolling();
    };
    ws.onerror = ()=> { ws.close(); };
    return ws;
  } catch(e){
    startPolling();
  }
}

let pollInterval = null;
function startPolling(){
  if(pollInterval) return;
  fetchStateOnce();
  pollInterval = setInterval(fetchStateOnce, 1000);
}

(function init(){
  fetchStateOnce();
  startWS();
  setTimeout(()=>{ if(!currentState) startPolling(); }, 500);
})();
/* -------------------------
   Visual helpers with fade
   ------------------------- */

async function fadeSwap(element, newValue, isImage = false) {
  if (!element) return;

  // fade out
  element.classList.add('fade-hidden');

  // wait for fade out
  await new Promise((res) => setTimeout(res, 250));

  // swap content
  if (isImage) {
    element.src = newValue;
  } else {
    element.textContent = newValue;
  }

  // fade in
  element.classList.remove('fade-hidden');
}

async function renderLeftSide(team) {
  if (!team) return;
  const logo = team.logo || team.logoSrc || 'logo-left.png';
  const seedText = team.seed ? `SEED ${team.seed}` : '';

  await fadeSwap(document.getElementById('LL'),  logo, true);
  await fadeSwap(document.getElementById('LTN'), team.name || 'TEAM LEFT');
  await fadeSwap(document.getElementById('LTS'), seedText);
  await fadeSwap(document.getElementById('LS'),  team.score != null ? team.score : 0);
}

async function renderRightSide(team) {
  if (!team) return;
  const logo = team.logo || team.logoSrc || 'logo-right.png';
  const seedText = team.seed ? `SEED ${team.seed}` : '';

  await fadeSwap(document.getElementById('RL'),  logo, true);
  await fadeSwap(document.getElementById('RTN'), team.name || 'TEAM RIGHT');
  await fadeSwap(document.getElementById('RTS'), seedText);
  await fadeSwap(document.getElementById('RS'),  team.score != null ? team.score : 0);
}

// =============================
// TIMER DISPLAY CONTROLS
// =============================
function showRoundTimer(text){
  const el = document.getElementById('CT');
  if (el) {
    el.classList.remove('spike-active');
  }
  setTxt('CT', text);
}

function showSpikeTimer(text){
  const el = document.getElementById('CT');
  if (el) {
    el.classList.add('spike-active');
  }
  setTxt('CT', text);
}

function showTimeoutTimer(text){
  const el = document.getElementById('CT');
  if (el) {
    el.classList.remove('spike-active');
  }
  setTxt('CT', text);
}




