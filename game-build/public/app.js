const $ = (selector) => document.querySelector(selector);
const entry = $('#entry-screen');
const lobby = $('#lobby-screen');
const game = $('#game-screen');
const nameInput = $('#player-name');
const roomInput = $('#room-code-input');
const entryError = $('#entry-error');
const storageKey = 'code-court-seat-v1';
const gameEndpoint = '/.netlify/functions/game';
let seat = null;
let pollTimer = null;
let pollBusy = false;
let connectionVersion = 0;
let roomState = null;
let selectedMode = 'developer';
let phaseKey = '';
let draftVote = '';
let draftObjection = '';
let draftPrediction = '';
let toastTimer = null;
let timerInterval = null;

function savedSeat() { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } }
function saveSeat(value) { seat = value; localStorage.setItem(storageKey, JSON.stringify(value)); }
function showScreen(which) {
  entry.classList.toggle('hidden', which !== 'entry');
  lobby.classList.toggle('hidden', which !== 'lobby');
  game.classList.toggle('hidden', which !== 'game');
}
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
async function api(action, payload) {
  const response = await fetch(gameEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, action }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
function connect(value) {
  if (pollTimer) clearInterval(pollTimer);
  const version = ++connectionVersion;
  const poll = async () => {
    if (pollBusy || version !== connectionVersion) return;
    pollBusy = true;
    try {
      const query = new URLSearchParams({ action: 'state', code: value.code, playerId: value.playerId });
      const response = await fetch(`${gameEndpoint}?${query}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not reconnect to the room.');
      if (version !== connectionVersion) return;
      roomState = data;
      $('#connection-label').textContent = 'CONNECTED TO COURT';
      renderRoom();
    } catch (error) {
      if (version !== connectionVersion) return;
      $('#connection-label').textContent = 'RECONNECTING…';
      if (error.message.includes('seat is no longer') || error.message.includes('room code was not found')) returnHome(value.name);
    } finally { pollBusy = false; }
  };
  $('#connection-label').textContent = 'CONNECTING…';
  poll();
  pollTimer = setInterval(poll, 900);
}
function errorToEntry(message) { entryError.textContent = message; }
function selectedModeFromUI() { return document.querySelector('.mode-option.selected')?.dataset.mode || 'developer'; }
const countdownToggle = $('#countdown-toggle');
const countdownPreset = $('#countdown-preset');
function syncCountdownSettings() {
  const enabled = countdownToggle.checked;
  $('#countdown-options').classList.toggle('hidden', !enabled);
  $('#countdown-toggle-state').textContent = enabled ? 'ON' : 'OFF';
  $('#countdown-custom').classList.toggle('hidden', !enabled || countdownPreset.value !== 'custom');
}
countdownToggle.addEventListener('change', syncCountdownSettings);
countdownPreset.addEventListener('change', syncCountdownSettings);
syncCountdownSettings();

function countdownForCreate() {
  const presets = {
    quick: { fake: 25, vote: 15, reveal: 10 },
    standard: { fake: 45, vote: 30, reveal: 15 },
    relaxed: { fake: 90, vote: 60, reveal: 20 }
  };
  if (countdownPreset.value !== 'custom') return { enabled: countdownToggle.checked, durations: presets[countdownPreset.value] || presets.standard };
  const durations = { fake: Number($('#fake-seconds').value), vote: Number($('#vote-seconds').value), reveal: Number($('#reveal-seconds').value) };
  if (countdownToggle.checked && Object.values(durations).some(value => !Number.isInteger(value) || value < 10 || value > 180)) throw new Error('Each custom phase must be between 10 and 180 seconds.');
  return { enabled: countdownToggle.checked, durations };
}

document.querySelectorAll('.mode-option').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.mode-option').forEach(x => x.classList.remove('selected'));
  button.classList.add('selected'); selectedMode = button.dataset.mode;
}));

$('#create-room').addEventListener('click', async () => {
  errorToEntry('');
  const name = nameInput.value.trim();
  if (!name) return errorToEntry('Enter your name first.');
  const playerId = crypto.randomUUID();
  try {
    const countdown = countdownForCreate();
    const result = await api('create', { name, mode: selectedModeFromUI(), playerId, countdown });
    const value = { ...result, name }; saveSeat(value); connect(value);
  } catch (error) { errorToEntry(error.message); }
});
$('#join-room').addEventListener('click', async () => {
  errorToEntry('');
  const name = nameInput.value.trim();
  const code = roomInput.value.trim().toUpperCase();
  if (!name) return errorToEntry('Enter your name first.');
  if (code.length !== 6) return errorToEntry('Room codes have 6 characters.');
  const old = savedSeat();
  const playerId = old?.code === code && old?.name?.toLowerCase() === name.toLowerCase() ? old.playerId : crypto.randomUUID();
  try {
    const result = await api('join', { code, name, playerId });
    const value = { ...result, name }; saveSeat(value); connect(value);
  } catch (error) { errorToEntry(error.message); }
});
roomInput.addEventListener('input', () => { roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
nameInput.addEventListener('keydown', event => { if (event.key === 'Enter') $('#create-room').click(); });
roomInput.addEventListener('keydown', event => { if (event.key === 'Enter') $('#join-room').click(); });

$('#copy-code').addEventListener('click', async () => {
  const code = roomState?.code || seat?.code;
  if (!code) return;
  try { await navigator.clipboard.writeText(code); $('#copy-feedback').textContent = 'COPIED TO CLIPBOARD'; }
  catch { $('#copy-feedback').textContent = `CODE: ${code}`; }
  setTimeout(() => { $('#copy-feedback').textContent = ''; }, 1800);
});
$('#start-game').addEventListener('click', async () => {
  try { await api('start', { code: seat.code, playerId: seat.playerId }); }
  catch (error) { toast(error.message); }
});
function hostAdvanceButton(s, label, reveal = false) {
  if (!s.countdown?.enabled && s.isHost) return `<button id="advance-phase" class="button button-secondary host-next">${label} <span>↗</span></button>`;
  if (!s.countdown?.enabled) return `<div class="host-wait">Waiting for the host…</div>`;
  return '';
}
function returnHome(name = seat?.name || '') {
  localStorage.removeItem(storageKey);
  connectionVersion++;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  pollBusy = false;
  seat = null; roomState = null; phaseKey = '';
  $('#room-controls').classList.add('hidden');
  nameInput.value = name;
  roomInput.value = '';
  $('#connection-label').textContent = 'READY TO RULE';
  showScreen('entry');
}
function renderRoomControls(s) {
  const box = $('#room-controls');
  if (s.phase === 'ended' || !s.players.some(p => p.id === s.playerId)) { box.innerHTML = ''; box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML = s.isHost
    ? '<button class="room-action end-action" id="end-room">End game</button><button class="room-action" id="leave-room">Leave</button>'
    : '<button class="room-action" id="leave-room">Leave room</button>';
  $('#leave-room').addEventListener('click', async () => {
    try { const name = seat?.name || ''; await api('leave', { code: seat.code, playerId: seat.playerId }); returnHome(name); }
    catch (error) { toast(error.message); }
  });
  $('#end-room')?.addEventListener('click', async () => {
    try { const name = seat?.name || ''; await api('end', { code: seat.code, playerId: seat.playerId }); returnHome(name); }
    catch (error) { toast(error.message); }
  });
}
function bindHostAdvance() {
  $('#advance-phase')?.addEventListener('click', async () => {
    try { await api('advance', { code: seat.code, playerId: seat.playerId }); }
    catch (error) { toast(error.message); }
  });
}
function personLabel(person, viewerId) {
  if (!person) return '';
  return `${escapeHtml(person.name)}${person.id === viewerId ? ' (you)' : ''}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
function renderPlayers(list, hostId, viewerId, showStatus = false) {
  return list.map(player => `<div class="player-seat ${player.id === viewerId ? 'you' : ''}"><span class="seat-dot ${showStatus && !player.connected ? 'offline' : ''}"></span><span>${escapeHtml(player.name)}${player.id === viewerId ? ' (you)' : ''}</span>${player.id === hostId ? '<span class="host-tag">HOST</span>' : ''}</div>`).join('');
}
function renderScore(list, state) {
  const ordered = [...list].sort((a,b) => b.score - a.score || b.truthPicks - a.truthPicks);
  return ordered.map((p, i) => `<div class="score-row ${p.id === state.playerId ? 'me' : ''} ${p.id === state.judgeId ? 'judge' : ''}"><span class="score-rank">${String(i + 1).padStart(2, '0')}</span><span class="score-name">${personLabel(p, state.playerId)}</span><span class="score-value">${p.score}</span></div>`).join('');
}
function renderRoom() {
  const s = roomState;
  if (!s) return;
  if (s.error) { toast(s.error); return; }
  if (s.phase === 'ended') { returnHome(); return; }
  renderRoomControls(s);
  if (s.phase === 'lobby') {
    phaseKey = '';
    showScreen('lobby');
    $('#room-code-display').textContent = s.code;
    $('#player-count').textContent = s.players.length;
    $('#player-list').innerHTML = renderPlayers(s.players, s.hostId, s.playerId, true);
    $('#room-countdown-setting').textContent = s.countdown?.enabled ? `Countdown: ${s.countdown.durations.fake}/${s.countdown.durations.vote}/${s.countdown.durations.reveal} s` : 'Countdown: off, host advances';
    $('#start-game').disabled = s.playerId !== s.hostId || s.players.length < 2;
    $('#start-hint').textContent = s.playerId !== s.hostId ? 'The host will start when everyone is ready.' : s.players.length < 2 ? 'Waiting for at least one more player…' : 'Your jury is ready when you are.';
    const rounds = Math.max(3, s.players.length);
    $('#lobby-rounds').textContent = String(rounds).padStart(2, '0');
    $('#mode-note').textContent = `${s.mode === 'general' ? 'GENERAL MODE · TRICK QUESTIONS' : 'DEVELOPER MODE · CODE ON TRIAL'}`;
    return;
  }
  if (s.phase === 'finished') { showScreen('game'); renderFinished(s); return; }
  showScreen('game');
  const key = `${s.roundNumber}-${s.phase}`;
  if (key !== phaseKey) { draftVote = ''; draftObjection = ''; draftPrediction = ''; phaseKey = key; $('#feedback').textContent = ''; }
  $('#game-mode-label').textContent = s.mode === 'general' ? 'GENERAL MODE' : 'DEVELOPER MODE';
  $('#round-current').textContent = s.roundNumber;
  $('#round-total').textContent = s.roundsTotal;
  $('#phase-label').textContent = ({ writing: 'FAKE ON THE RECORD', vote: 'THE VOTE IS OPEN', reveal: 'THE VERDICT' })[s.phase] || '';
  $('#question-prompt').textContent = s.phase === 'reveal' ? s.reveal.question.prompt : s.question?.prompt || '';
  const code = s.phase === 'reveal' ? s.reveal.question.code : s.question?.code;
  const codeBox = $('#code-snippet');
  codeBox.classList.toggle('hidden', !code);
  codeBox.querySelector('code').textContent = code || '';
  const truth = $('#judge-truth');
  if (s.viewerIsJudge && s.question?.truth) { truth.textContent = `THE REAL ANSWER: ${s.question.truth}`; truth.classList.remove('hidden'); }
  else truth.classList.add('hidden');
  $('#score-list').innerHTML = renderScore(s.players, s);
  renderTimer(s);
  if (s.phase === 'writing') renderWriting(s);
  else if (s.phase === 'vote') renderVoting(s);
  else renderReveal(s);
}

function renderTimer(s) {
  clearInterval(timerInterval);
  const active = Boolean(s.countdown?.enabled);
  $('#timer-box').classList.toggle('hidden', !active);
  $('#host-advance-indicator').classList.toggle('hidden', active || !s.isHost);
  if (!active) { $('#timer').textContent = '—'; $('#timer-bar').style.width = '0%'; return; }
  const phaseName = s.phase === 'writing' ? 'fake' : s.phase === 'vote' ? 'vote' : 'reveal';
  const duration = s.countdown.durations[phaseName];
  const draw = () => {
    const left = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000));
    $('#timer').textContent = left;
    $('#timer-bar').style.width = `${Math.max(0, Math.min(100, (left / duration) * 100))}%`;
    const revealCount = $('#reveal-count');
    if (s.phase === 'reveal' && revealCount) revealCount.textContent = left;
  };
  draw(); timerInterval = setInterval(draw, 150);
}
function waiting(label) { return `<div class="waiting-box"><span class="waiting-spinner"></span><span>${label}</span></div>`; }
function renderWriting(s) {
  if (s.viewerIsJudge) {
    $('#phase-card').innerHTML = `<div class="phase-title">You’re the Judge this round.</div><p class="phase-copy">The truth is on the record above. Watch the fakes come in; you’ll predict which wrong answer draws the most votes next.</p><div class="judge-banner">JUDGE’S NOTE · Your prediction is made during the vote. No fake or vote for you this round.</div>${hostAdvanceButton(s, 'Next')}`;
    bindHostAdvance();
    return;
  }
  if (s.myFake) {
    $('#phase-card').innerHTML = `<div class="phase-title">Fake submitted.</div><p class="phase-copy">Your answer is hidden from the rest of the jury. The court moves on as soon as everyone is ready.</p>${s.countdown?.enabled ? waiting('Waiting for the other lawyers…') : hostAdvanceButton(s, 'Next')}`;
    bindHostAdvance();
    return;
  }
  const suggestions = s.question?.suggestions || [];
  const suggestionHtml = suggestions.map((item, index) => `<button type="button" class="fake-suggestion" data-suggestion="${index}"><span class="suggestion-text">${escapeHtml(item.text)}</span><span class="suggestion-reason">${escapeHtml(item.reason)}</span></button>`).join('');
  $('#phase-card').innerHTML = `<div class="phase-title">Put a fake on the record.</div><p class="phase-copy">Keep it believable. You have 60 characters; the truth is rejected if you enter it.</p><div class="fake-entry"><input id="fake-answer" class="text-input" maxlength="60" placeholder="Your convincing fake…" autocomplete="off"><span class="char-count"><b id="fake-count">0</b>/60</span><button id="submit-fake" class="button button-primary">Submit ↗</button></div><div class="suggestion-tools"><button type="button" id="suggestion-toggle" class="button button-secondary">Need an idea?</button><div id="suggestion-panel" class="suggestion-panel hidden">${suggestionHtml}</div></div>${hostAdvanceButton(s, 'Next')}`;
  const input = $('#fake-answer');
  input.addEventListener('input', () => $('#fake-count').textContent = input.value.length);
  $('#suggestion-toggle').addEventListener('click', () => $('#suggestion-panel').classList.toggle('hidden'));
  $('#phase-card').querySelectorAll('.fake-suggestion').forEach(button => button.addEventListener('click', () => {
    input.value = suggestions[Number(button.dataset.suggestion)]?.text || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }));
  input.addEventListener('keydown', event => { if (event.key === 'Enter') $('#submit-fake').click(); });
  $('#submit-fake').addEventListener('click', async () => {
    $('#feedback').textContent = '';
    try { await api('fake', { code: seat.code, playerId: seat.playerId, text: input.value }); }
    catch (error) { $('#feedback').textContent = error.message; }
  });
  bindHostAdvance();
}
function renderVoting(s) {
  const options = s.options || [];
  const judge = s.viewerIsJudge;
  const already = judge ? Boolean(s.myPrediction) : Boolean(s.myVote);
  if (already) {
    const others = s.players.filter(p => p.id !== s.playerId).length;
    const count = Object.values({}).length;
    const waitingLabel = judge ? 'Prediction locked. Waiting for the jury to vote…' : 'Vote locked. Waiting for the rest of the jury…';
    $('#phase-card').innerHTML = `<div class="phase-title">${judge ? 'Prediction on the record.' : 'Your vote is on the record.'}</div><p class="phase-copy">${waitingLabel}</p>${s.countdown?.enabled ? waiting('The Judge reveals all in a moment…') : hostAdvanceButton(s, 'Next')}<div class="vote-progress">${judge ? 'JUDGE PREDICTION SUBMITTED' : `${others} OTHER SEATS IN COURT`}</div>`;
    bindHostAdvance();
    return;
  }
  const selectable = options.filter(o => !o.ownFake && !(judge && s.question?.truth && normalize(o.text) === normalize(s.question.truth)));
  const choices = selectable.map((o, i) => `<button class="choice ${draftVote === o.id ? 'selected' : ''} ${draftObjection === o.id ? 'objection-selected' : ''}" data-option="${o.id}"><span class="choice-letter">${String.fromCharCode(65 + i)}</span><span>${escapeHtml(o.text)}</span></button>`).join('');
  if (judge) {
    $('#phase-card').innerHTML = `<div class="phase-title">Which wrong answer will fool the most?</div><p class="phase-copy">Make your secret prediction. The answer key is visible above; predict any decoy or player fake.</p><div class="choice-grid">${choices}</div><button class="button button-primary vote-submit" id="submit-choice" ${draftVote ? '' : 'disabled'}>Lock Judge prediction <span>↗</span></button>${hostAdvanceButton(s, 'Next')}`;
    $('#phase-card').querySelectorAll('.choice').forEach(btn => btn.addEventListener('click', () => { draftVote = btn.dataset.option; renderVoting(s); }));
    $('#submit-choice').addEventListener('click', async () => sendVote(s, draftVote, ''));
    bindHostAdvance();
    return;
  }
  const eligibleObjections = selectable.filter(o => !s.myObjectionUsed && o.id !== draftVote);
  const objectionOptions = eligibleObjections.map(o => `<option value="${o.id}" ${draftObjection === o.id ? 'selected' : ''}>${escapeHtml(o.text)}</option>`).join('');
  $('#phase-card').innerHTML = `<div class="phase-title">Call the truth.</div><p class="phase-copy">Select the real answer. Optional: raise your one Objection against a fake alongside your vote.</p><div class="choice-grid">${choices}</div><div class="vote-instructions"><span><i class="legend-truth"></i> YOUR VOTE</span><span><i class="legend-objection"></i> OBJECTION</span></div>${s.myObjectionUsed ? '<p class="phase-copy">Your Objection has already been used this game.</p>' : `<label class="field-label" for="objection-select">OPTIONAL OBJECTION · ONCE PER GAME</label><select id="objection-select" class="text-input"><option value="">No Objection</option>${objectionOptions}</select>`}<button class="button button-primary vote-submit" id="submit-choice" ${draftVote ? '' : 'disabled'}>Submit vote${draftObjection ? ' + Objection' : ''} <span>↗</span></button>${hostAdvanceButton(s, 'Next')}`;
  $('#phase-card').querySelectorAll('.choice').forEach(btn => btn.addEventListener('click', () => { draftVote = btn.dataset.option; renderVoting(s); }));
  const select = $('#objection-select');
  if (select) select.addEventListener('change', () => { draftObjection = select.value; const button = $('#submit-choice'); if (button) button.innerHTML = `Submit vote${draftObjection ? ' + Objection' : ''} <span>↗</span>`; });
  $('#submit-choice').addEventListener('click', async () => sendVote(s, draftVote, draftObjection));
  bindHostAdvance();
}
function normalize(value) { return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ').replace(/[.,!?;:]+$/g,''); }
async function sendVote(s, answerId, objectionAnswerId) {
  if (!answerId) return;
  try { await api('vote', { code: seat.code, playerId: seat.playerId, answerId, objectionAnswerId }); }
  catch (error) { $('#feedback').textContent = error.message; }
}
function renderReveal(s) {
  const r = s.reveal;
  const judge = s.players.find(p => p.id === r.judgeId);
  const judgeResult = judge ? `${personLabel(judge, s.playerId)} ${r.judgePredictionRight ? 'called the top fake (+2).' : 'missed the top fake.'}` : '';
  const rows = r.options.map(option => {
    const truth = option.type === 'truth';
    const author = option.type === 'decoy' ? 'House decoy' : option.authors.length ? `Fake by ${option.authors.map(p => personLabel(p, s.playerId)).join(', ')}` : '';
    const fooled = option.fooledPlayers.length ? option.fooledPlayers.map(p => personLabel(p, s.playerId)).join(', ') : 'nobody';
    const voters = option.voters.length ? option.voters.map(p => personLabel(p, s.playerId)).join(', ') : 'No votes';
    const whyWrong = !truth && option.reason ? `<span class="reveal-why"><strong>Why it's wrong:</strong> ${escapeHtml(option.reason)}</span>` : '';
    return `<div class="reveal-option ${truth ? 'truth-option' : ''}"><span class="reveal-option-text">${escapeHtml(option.text)}</span><span class="reveal-tag">${truth ? 'THE TRUTH' : author}</span><span class="reveal-people"><strong>${truth ? 'Picked by' : 'Fooled'}:</strong> ${truth ? voters : fooled}</span>${whyWrong}</div>`;
  }).join('');
  const scoreRows = r.scoreboard.map((p, i) => {
    const gain = r.scoreDeltas?.[p.id] || 0;
    return `<div class="score-row ${p.id === s.playerId ? 'me' : ''}"><span class="score-rank">${String(i+1).padStart(2,'0')}</span><span class="score-name">${personLabel(p, s.playerId)}</span><span class="delta">${gain > 0 ? `+${gain}` : gain < 0 ? String(gain) : '—'}</span><span class="score-value">${p.score}</span></div>`;
  }).join('');
  const revealControl = s.countdown?.enabled ? `<div class="reveal-next">NEXT PHASE IN <span id="reveal-count">${s.countdown.durations.reveal}</span> SEC</div>` : hostAdvanceButton(s, 'Next question');
  $('#phase-card').innerHTML = `<div class="reveal-card"><div class="reveal-top"><span class="verdict">THE COURT FINDS</span><span class="question-docket">${judgeResult}</span></div><div class="answer-truth">${escapeHtml(r.answer)}</div><p class="explanation">${escapeHtml(r.explanation)}</p>${rows}<div class="scoreboard-reveal"><div class="score-head"><span>UPDATED SCOREBOARD</span><span>POINTS</span></div>${scoreRows}</div>${revealControl}</div>`;
  bindHostAdvance();
}
function renderFinished(s) {
  clearInterval(timerInterval);
  $('#timer-box').classList.add('hidden'); $('#host-advance-indicator').classList.add('hidden');
  $('#timer').textContent = '—'; $('#timer-bar').style.width = '0%';
  $('#round-current').textContent = s.roundsTotal; $('#round-total').textContent = s.roundsTotal; $('#phase-label').textContent = 'CASE CLOSED';
  $('#question-prompt').textContent = 'The jury has reached a verdict.'; $('#code-snippet').classList.add('hidden'); $('#judge-truth').classList.add('hidden');
  const winners = s.final.winners.map(id => s.final.players.find(p => p.id === id)).filter(Boolean);
  const rows = s.final.players.map((p,i)=>`<div class="score-row ${p.id===s.playerId?'me':''}"><span class="score-rank">${String(i+1).padStart(2,'0')}</span><span class="score-name">${personLabel(p, s.playerId)}</span><span class="delta">${p.truthPicks} truth${p.truthPicks===1?'':'s'}</span><span class="score-value">${p.score}</span></div>`).join('');
  const tieBreak = s.final.topScoreTied ? '<p class="phase-copy">Final tie-break: most truths picked.</p>' : '';
  const replayAction = s.isHost ? '<button id="play-again" class="button button-primary">Play again with the same players <span>↗</span></button>' : '<div class="host-wait">Waiting for the host…</div>';
  $('#phase-card').innerHTML = `<div class="final-banner">${winners.length === 1 ? `${personLabel(winners[0], s.playerId)} wins the case.` : `Shared win: ${winners.map(p => personLabel(p, s.playerId)).join(' & ')}.`}</div>${tieBreak}<p class="phase-copy">This courtroom has closed.</p><div class="scoreboard-reveal"><div class="score-head"><span>FINAL SCOREBOARD</span><span>POINTS</span></div>${rows}</div><div class="final-actions">${replayAction}</div>`;
  $('#play-again')?.addEventListener('click', async () => {
    try { await api('replay', { code: seat.code, playerId: seat.playerId }); }
    catch (error) { toast(error.message); }
  });
}

async function restore() {
  const value = savedSeat();
  if (!value?.code || !value?.name) return;
  try {
    const result = await api('join', { code: value.code, name: value.name, playerId: value.playerId });
    const next = { ...value, ...result }; saveSeat(next); connect(next); nameInput.value = value.name;
  } catch {
    localStorage.removeItem(storageKey);
    nameInput.value = value.name || '';
  }
}
window.addEventListener('beforeunload', () => { if (pollTimer) clearInterval(pollTimer); });
restore();
