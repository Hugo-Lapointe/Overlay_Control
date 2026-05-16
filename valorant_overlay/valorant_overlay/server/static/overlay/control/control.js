// control.js - clean client for control panel
(async () => {
  const $ = (id) => document.getElementById(id);
    // Manual timer state
  let timerInterval = null;
  let timerRemaining = 0;
  let timerPaused = false;
  
  let sidesFlipped = false;
  let lastState = null;


  function formatTimer(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function stopManualTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function pauseManualTimer() {
    if (timerInterval) {
      stopManualTimer();
      timerPaused = true;
      updateTimerField();
      saveState({
        live: buildLiveState({ timer: formatTimer(timerRemaining), phase: lastPhase, paused: true })
      });
    }
  }

  function buildLiveState(overrides = {}) {
    const live = Object.assign({}, lastState && lastState.live ? lastState.live : {});
    if (overrides.round !== undefined) live.round = overrides.round;
    if (overrides.timer !== undefined) live.timer = overrides.timer;
    if (overrides.phase !== undefined) live.phase = overrides.phase;
    if (overrides.spikeActive !== undefined) live.spikeActive = overrides.spikeActive;
    if (overrides.timeoutActive !== undefined) live.timeoutActive = overrides.timeoutActive;
    if (overrides.sidesFlipped !== undefined) live.sidesFlipped = overrides.sidesFlipped;
    return live;
  }

  function updateTimerField() {
    if ($('round-timer')) {
      $('round-timer').value = timerRemaining > 0 ? formatTimer(timerRemaining) : '';
    }
  }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timeoutId);
    showToast.timeoutId = setTimeout(() => {
      toast.classList.remove('show');
    }, 1800);
  }

  let lastPhase = '';

  function startManualTimer(mode, seconds) {
    stopManualTimer();
    timerPaused = false;
    timerRemaining = seconds;

    const phase =
      mode === 'buy' ? 'BUY' :
      mode === 'spike' ? 'SPIKE' :
      mode === 'timeout' ? 'TIMEOUT' :
      'ROUND';

    lastPhase = phase;
    const spikeActive = (mode === 'spike');
    const timeoutActive = (mode === 'timeout');

    function pushState() {
      updateTimerField();
      saveState({
        live: buildLiveState({
          timer: formatTimer(timerRemaining),
          phase,
          spikeActive,
          timeoutActive,
          sidesFlipped
        })
      });
    }

    // first push
    pushState();

    timerInterval = setInterval(() => {
      timerRemaining -= 1;
      if (timerRemaining <= 0) {
        timerRemaining = 0;
        pushState();
        stopManualTimer();
      } else {
        pushState();
      }
    }, 1000);
  }


  const SERVER_TOKEN = new URLSearchParams(location.search).get('token') || '';

  async function fetchState() {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data && data.state) applyState(data.state);
      else console.warn('Malformed /api/state response', data);
    } catch (err) {
      console.error('fetchState error', err);
    }
  }

  async function saveState(newState) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (SERVER_TOKEN) headers['x-overlay-token'] = SERVER_TOKEN;

      const res = await fetch('/api/state', {
        method: 'POST',
        headers,
        body: JSON.stringify(newState)
      });
      const data = await res.json();
      console.log('Saved state', data);
    } catch (err) {
      console.error('saveState error', err);
    }
  }

function applyState(state) {
  lastState = state || {};

  $('left-name').value  = (state.left && state.left.name) || '';
  $('left-logo').value  = (state.left && state.left.logo) || '';
  $('left-score').value = (state.left && state.left.score) || 0;
  $('left-seed').value  = state.left?.seed ?? '';

  $('right-name').value  = (state.right && state.right.name) || '';
  $('right-logo').value  = (state.right && state.right.logo) || '';
  $('right-score').value = (state.right && state.right.score) || 0;
  $('right-seed').value  = state.right?.seed ?? '';

  $('round-number').value = state.live?.round ?? '';
  $('round-timer').value  = state.live?.timer ?? '';

  // read flip flag from live state
  sidesFlipped = !!(state.live && state.live.sidesFlipped);
}

  // Helper function to build and save full state
  function saveFullState() {
    const newState = {
      left: {
        name: $('left-name').value,
        logo: $('left-logo').value,
        score: Number($('left-score').value) || 0,
        seed: Number($('left-seed').value) || null
      },
      right: {
        name: $('right-name').value,
        logo: $('right-logo').value,
        score: Number($('right-score').value) || 0,
        seed: Number($('right-seed').value) || null
      },
      live: {
        round: Number($('round-number').value) || null,
        timer: $('round-timer').value || '',
        sidesFlipped
      }
    };
    saveState(newState);
  }

  // Auto-save on team field changes
  ['left-name', 'left-logo', 'left-seed', 'right-name', 'right-logo', 'right-seed'].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('change', saveFullState);
      el.addEventListener('blur', saveFullState);
    }
  });

  function adjustNumberField(fieldId, delta) {
    const input = $(fieldId);
    if (!input) return;
    const current = Number(input.value) || 0;
    input.value = Math.max(0, current + delta);
    saveFullState();
  }

  const leftScoreDec = $('left-score-dec');
  const leftScoreInc = $('left-score-inc');
  const rightScoreDec = $('right-score-dec');
  const rightScoreInc = $('right-score-inc');
  const roundDec = $('round-dec');
  const roundInc = $('round-inc');

  if (leftScoreDec) leftScoreDec.addEventListener('click', () => adjustNumberField('left-score', -1));
  if (leftScoreInc) leftScoreInc.addEventListener('click', () => adjustNumberField('left-score', 1));
  if (rightScoreDec) rightScoreDec.addEventListener('click', () => adjustNumberField('right-score', -1));
  if (rightScoreInc) rightScoreInc.addEventListener('click', () => adjustNumberField('right-score', 1));
  if (roundDec) roundDec.addEventListener('click', () => adjustNumberField('round-number', -1));
  if (roundInc) roundInc.addEventListener('click', () => adjustNumberField('round-number', 1));

  const roundNumberInput = $('round-number');
  if (roundNumberInput) {
    roundNumberInput.addEventListener('change', saveFullState);
  }

  // Auto-save on score field changes
  ['left-score', 'right-score'].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('change', saveFullState);
    }
  });

  // live updates via websocket
  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${wsProto}//${location.host}`);
  ws.onopen = () => console.log('control: ws connected');
  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      if (data.type === 'state') applyState(data.state);
    } catch (err) {
      console.error('control ws onmessage error', err);
    }
  };
  ws.onclose = () => console.log('control: ws closed');
  // Timer buttons
  const buyBtn = $('btn-timer-buy');
  if (buyBtn) buyBtn.addEventListener('click', () => {
    const v = Number($('timer-buy-seconds').value) || 0;
    if (v > 0) startManualTimer('buy', v);
  });

  const roundBtn = $('btn-timer-round');
  if (roundBtn) roundBtn.addEventListener('click', () => {
    const v = Number($('timer-round-seconds').value) || 0;
    if (v > 0) startManualTimer('round', v);
  });

  const spikeBtn = $('btn-timer-spike');
  if (spikeBtn) spikeBtn.addEventListener('click', () => {
    const v = Number($('timer-spike-seconds').value) || 0;
    if (v > 0) startManualTimer('spike', v);
  });

  const timeoutBtn = $('btn-timer-timeout');
  if (timeoutBtn) timeoutBtn.addEventListener('click', () => {
    const v = Number($('timer-timeout-seconds').value) || 0;
    if (v > 0) startManualTimer('timeout', v);
  });

  const stopBtn = $('btn-timer-stop');
  if (stopBtn) stopBtn.addEventListener('click', () => {
    stopManualTimer();
    saveState({
      live: buildLiveState({
        timer: '',
        phase: '',
        spikeActive: false,
        timeoutActive: false,
        sidesFlipped
      })
    });
  });

  const customStartBtn = $('btn-timer-custom-start');
  const customPauseBtn = $('btn-timer-custom-pause');
  const customClearBtn = $('btn-timer-custom-clear');

  if (customStartBtn) customStartBtn.addEventListener('click', () => {
    const v = Number($('timer-custom-seconds').value) || 0;
    if (v > 0) {
      startManualTimer('round', v);
      showToast('Custom timer started');
    }
  });
  if (customPauseBtn) customPauseBtn.addEventListener('click', () => {
    pauseManualTimer();
    showToast('Timer paused');
  });
  if (customClearBtn) customClearBtn.addEventListener('click', () => {
    stopManualTimer();
    saveState({
      live: buildLiveState({
        timer: '',
        phase: '',
        spikeActive: false,
        timeoutActive: false,
        sidesFlipped
      })
    });
    showToast('Timer cleared');
  });

  const keyHandler = (event) => {
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    switch (event.key.toLowerCase()) {
      case 'q': adjustNumberField('left-score', -1); showToast('Left score -'); break;
      case '1': adjustNumberField('left-score', 1); showToast('Left score +'); break;
      case 'w': adjustNumberField('right-score', -1); showToast('Right score -'); break;
      case '2': adjustNumberField('right-score', 1); showToast('Right score +'); break;
      case 'a': adjustNumberField('round-number', -1); showToast('Round -'); break;
      case 's': adjustNumberField('round-number', 1); showToast('Round +'); break;
      case 'b': {
        const v = Number($('timer-buy-seconds').value) || 0;
        if (v > 0) { startManualTimer('buy', v); showToast('Buy timer started'); }
        break;
      }
      case 'r': {
        const v = Number($('timer-round-seconds').value) || 0;
        if (v > 0) { startManualTimer('round', v); showToast('Round timer started'); }
        break;
      }
      case 'x': {
        const v = Number($('timer-spike-seconds').value) || 0;
        if (v > 0) { startManualTimer('spike', v); showToast('Spike timer started'); }
        break;
      }
      case 'o': {
        const v = Number($('timer-timeout-seconds').value) || 0;
        if (v > 0) { startManualTimer('timeout', v); showToast('Timeout timer started'); }
        break;
      }
      case 't': {
        const v = Number($('timer-custom-seconds').value) || 0;
        if (v > 0) { startManualTimer('round', v); showToast('Custom timer started'); }
        break;
      }
      case 'p': pauseManualTimer(); showToast('Timer paused'); break;
      case 'c': {
        stopManualTimer();
        saveState({
          live: buildLiveState({
            timer: '',
            phase: '',
            spikeActive: false,
            timeoutActive: false,
            sidesFlipped
          })
        });
        showToast('Timer cleared');
        break;
      }
    }
  };
  window.addEventListener('keydown', keyHandler);

  const flipBtn = $('btn-toggle-sides');
  if (flipBtn) flipBtn.addEventListener('click', () => {
    sidesFlipped = !sidesFlipped;

    // base on lastState.live so we do not wipe other live fields
    const live = Object.assign({}, lastState && lastState.live ? lastState.live : {});
    live.sidesFlipped = sidesFlipped;

    // also keep whatever is in the round and timer inputs
    const inputRound = Number($('round-number').value) || null;
    const inputTimer = $('round-timer').value || '';

    if (inputRound !== null) live.round = inputRound;
    if (inputTimer) live.timer = inputTimer;

    saveState({ live });
  });

  // initial load
  fetchState();
})();




