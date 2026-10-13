const crypto = require('node:crypto');
const questions = require('../questions');

const ROOM_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const PRESENCE_REFRESH_MS = 8_000;

function normalizeAnswer(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:]+$/g, '');
}

function playersIn(room) { return Object.values(room.players); }
function archivedPlayers(room) { return Object.values(room.departedPlayers); }
function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function uniqueId(prefix, value) {
  return `${prefix}-${crypto.createHash('sha1').update(value).digest('hex').slice(0, 10)}`;
}
function createRoom({ code, name, playerId, mode, countdown }, now = Date.now()) {
  const id = String(playerId || crypto.randomUUID());
  const player = { id, name: String(name).trim().slice(0, 20), score: 0, truthPicks: 0, objectionUsed: false, lastSeenAt: now };
  const durations = {
    fake: Number(countdown?.durations?.fake ?? 45),
    vote: Number(countdown?.durations?.vote ?? 30),
    reveal: Number(countdown?.durations?.reveal ?? 15)
  };
  const room = {
    code,
    mode: mode === 'general' ? 'general' : 'developer',
    hostId: id,
    countdown: { enabled: Boolean(countdown?.enabled), durations },
    phase: 'lobby',
    players: { [id]: player },
    departedPlayers: {},
    roundsTotal: 0,
    round: null,
    deadline: 0,
    reveal: null,
    final: null,
    questionOrder: [],
    playersOrder: [],
    judgedIds: [],
    firstJudgeIndex: 0,
    createdAt: now,
    lastActivityAt: now
  };
  return { room, playerId: id };
}

function optionsFor(room) {
  const question = room.round.question;
  const byKey = new Map();
  const add = (text, type, authorIds = []) => {
    const key = normalizeAnswer(text);
    if (!byKey.has(key)) byKey.set(key, { id: uniqueId(type, key), text, type, authorIds: [...authorIds] });
    else if (type === 'fake') {
      const option = byKey.get(key);
      option.authorIds = [...new Set([...option.authorIds, ...authorIds])];
      option.type = 'fake';
    }
  };
  add(question.answer, 'truth');
  question.decoys.forEach(text => add(text, 'decoy'));
  for (const player of playersIn(room)) {
    const fake = room.round.fakes[player.id];
    if (fake) add(fake, 'fake', [player.id]);
  }
  return shuffle([...byKey.values()]);
}

function snapshot(room, viewerId, now = Date.now()) {
  const players = playersIn(room).map(player => ({
    id: player.id,
    name: player.name,
    score: player.score,
    truthPicks: player.truthPicks,
    connected: now - player.lastSeenAt < 20_000
  }));
  const round = room.round;
  const view = {
    code: room.code,
    mode: room.mode,
    hostId: room.hostId,
    isHost: room.hostId === viewerId,
    countdown: room.countdown,
    phase: room.phase,
    players,
    roundsTotal: room.roundsTotal,
    roundNumber: round?.number || 0,
    deadline: room.deadline,
    playerId: viewerId,
    judgeId: round?.judgeId || null,
    viewerIsJudge: Boolean(round && round.judgeId === viewerId),
    myFake: Boolean(round?.fakes[viewerId]),
    myVote: round?.votes[viewerId] || null,
    myPrediction: round?.predictions[viewerId] || null,
    myObjectionUsed: Boolean(room.players[viewerId]?.objectionUsed),
    options: [],
    reveal: null,
    final: null,
    error: null
  };
  if (room.phase === 'vote' && round) {
    view.options = (round.optionSet || optionsFor(room)).map(option => ({
      id: option.id,
      text: option.text,
      ownFake: option.authorIds.includes(viewerId)
    }));
  }
  if (round && ['writing', 'vote'].includes(room.phase)) {
    const question = round.question;
    view.question = { prompt: question.prompt, code: question.code || null };
    if (view.viewerIsJudge) view.question.truth = question.answer;
    else if (room.phase === 'writing') view.question.suggestions = round.suggestionsByPlayer[viewerId] || [];
  }
  if (room.phase === 'reveal') view.reveal = room.reveal;
  if (room.phase === 'finished') view.final = room.final;
  return view;
}

function setDeadline(room, phase, now) {
  if (!room.countdown.enabled) {
    room.deadline = 0;
    return;
  }
  const duration = phase === 'fake' ? room.countdown.durations.fake
    : phase === 'vote' ? room.countdown.durations.vote
      : room.countdown.durations.reveal;
  room.deadline = now + duration * 1000;
}

function startVote(room, now) {
  if (room.phase !== 'writing') return false;
  room.phase = 'vote';
  room.round.optionSet = optionsFor(room);
  setDeadline(room, 'vote', now);
  return true;
}

function finishRound(room, now) {
  if (room.phase !== 'vote') return false;
  const round = room.round;
  const options = round.optionSet || optionsFor(room);
  for (const option of options) option.votes = [];
  const optionById = new Map(options.map(option => [option.id, option]));
  for (const [playerId, optionId] of Object.entries(round.votes)) {
    const option = optionById.get(optionId);
    if (option) option.votes.push(playerId);
  }
  const truth = options.find(option => option.type === 'truth');
  const wrongs = options.filter(option => option.type !== 'truth');
  const judge = room.players[round.judgeId];
  const topWrongVotes = Math.max(0, ...wrongs.map(option => option.votes.length));
  const judgePrediction = round.predictions[round.judgeId] || null;
  const judgePredictionRight = Boolean(judgePrediction && topWrongVotes > 0 && wrongs.some(option => option.id === judgePrediction && option.votes.length === topWrongVotes));
  const scoresBefore = new Map(playersIn(room).map(player => [player.id, player.score]));

  for (const player of playersIn(room)) {
    const picked = optionById.get(round.votes[player.id]);
    if (picked?.type === 'truth') { player.score += 3; player.truthPicks += 1; }
    if (picked && picked.type !== 'truth' && !picked.authorIds.includes(player.id)) {
      for (const authorId of picked.authorIds) {
        const author = room.players[authorId];
        if (author) author.score += 1;
      }
    }
    const objection = optionById.get(round.objections[player.id]);
    if (objection) player.score += objection.type === 'truth' ? -1 : 2;
  }

  const firstCorrect = [...(round.voteOrder || [])].sort((a, b) => a.at - b.at)[0];
  if (firstCorrect?.optionId === truth?.id && room.players[firstCorrect.playerId]) room.players[firstCorrect.playerId].score += 1;
  if (judge && judgePredictionRight) judge.score += 2;

  room.phase = 'reveal';
  setDeadline(room, 'reveal', now);
  room.reveal = {
    question: { prompt: round.question.prompt, code: round.question.code || null },
    truthId: truth?.id,
    answer: round.question.answer,
    explanation: round.question.explanation,
    judgeId: round.judgeId,
    judgePrediction,
    judgePredictionRight,
    options: options.map(option => ({
      id: option.id,
      text: option.text,
      type: option.type,
      reason: option.type === 'truth' ? '' : round.question.decoys?.map((text, index) => normalizeAnswer(text) === normalizeAnswer(option.text) ? round.question.decoyReasons?.[index] : '').find(Boolean)
        || round.question.suggestions?.find(item => normalizeAnswer(item.text) === normalizeAnswer(option.text))?.reason || '',
      authors: option.authorIds.map(id => ({ id, name: room.players[id]?.name || room.departedPlayers[id]?.name })).filter(player => player.name),
      fooledPlayers: option.votes.filter(id => !option.authorIds.includes(id)).map(id => ({ id, name: room.players[id]?.name || room.departedPlayers[id]?.name })).filter(player => player.name),
      voters: option.votes.map(id => ({ id, name: room.players[id]?.name || room.departedPlayers[id]?.name })).filter(player => player.name)
    })),
    fastestPlayerId: firstCorrect?.optionId === truth?.id ? firstCorrect.playerId : null,
    scoreDeltas: Object.fromEntries(playersIn(room).map(player => [player.id, player.score - scoresBefore.get(player.id)])),
    scoreboard: [...playersIn(room), ...archivedPlayers(room)].sort((a, b) => b.score - a.score || b.truthPicks - a.truthPicks).map(player => ({ id: player.id, name: player.name, score: player.score, truthPicks: player.truthPicks }))
  };
  return true;
}

function startRound(room, number, now) {
  if (number > room.roundsTotal) {
    room.phase = 'finished';
    const sorted = [...playersIn(room), ...archivedPlayers(room)].sort((a, b) => b.score - a.score || b.truthPicks - a.truthPicks);
    const top = sorted[0];
    room.final = sorted.length ? {
      players: sorted.map(player => ({ id: player.id, name: player.name, score: player.score, truthPicks: player.truthPicks })),
      winners: sorted.filter(player => player.score === top.score && player.truthPicks === top.truthPicks).map(player => player.id),
      topScoreTied: sorted.filter(player => player.score === top.score).length > 1
    } : { players: [], winners: [], topScoreTied: false };
    room.deadline = 0;
    return;
  }
  const startIndex = (room.firstJudgeIndex + number - 1) % Math.max(1, room.playersOrder.length);
  let judgeId = null;
  for (let offset = 0; offset < room.playersOrder.length; offset++) {
    const candidate = room.playersOrder[(startIndex + offset) % room.playersOrder.length];
    if (room.players[candidate] && !room.judgedIds.includes(candidate)) { judgeId = candidate; break; }
  }
  if (!judgeId) judgeId = playersIn(room)[0]?.id || null;
  if (judgeId && !room.judgedIds.includes(judgeId)) room.judgedIds.push(judgeId);

  const question = room.questionOrder[number - 1];
  const pairs = [];
  const pool = question.suggestions || [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) pairs.push([pool[i], pool[j]]);
  const randomizedPairs = shuffle(pairs);
  const suggestionsByPlayer = {};
  let pairIndex = 0;
  for (const player of playersIn(room)) {
    if (player.id !== judgeId) suggestionsByPlayer[player.id] = randomizedPairs[pairIndex++] || pool.slice(0, 2);
  }
  room.phase = 'writing';
  room.round = { number, judgeId, question, fakes: {}, votes: {}, predictions: {}, objections: {}, voteOrder: [], optionSet: null, suggestionsByPlayer };
  room.reveal = null;
  setDeadline(room, 'fake', now);
}

function beginGame(room, now) {
  room.playersOrder = playersIn(room).map(player => player.id);
  room.roundsTotal = Math.max(3, room.playersOrder.length);
  const bank = shuffle(questions[room.mode]);
  room.questionOrder = bank.slice(0, room.roundsTotal);
  for (const player of playersIn(room)) { player.score = 0; player.truthPicks = 0; player.objectionUsed = false; }
  room.departedPlayers = {};
  room.final = null;
  room.reveal = null;
  room.judgedIds = [];
  room.firstJudgeIndex = crypto.randomInt(Math.max(1, room.playersOrder.length));
  startRound(room, 1, now);
}

function submitEveryone(room, now) {
  if (!room.round || !Object.keys(room.players).length) return;
  const judgeId = room.round.judgeId;
  const contestants = playersIn(room).filter(player => player.id !== judgeId);
  if (room.phase === 'writing' && contestants.every(player => room.round.fakes[player.id])) startVote(room, now);
  if (room.phase === 'vote') {
    const votersDone = contestants.every(player => Object.hasOwn(room.round.votes, player.id));
    const judgeDone = !judgeId || Object.hasOwn(room.round.predictions, judgeId);
    if (votersDone && judgeDone) finishRound(room, now);
  }
}

function advanceExpired(room, now = Date.now()) {
  if (!room.countdown.enabled || !room.deadline || room.deadline > now) return false;
  if (room.phase === 'writing') startVote(room, now);
  else if (room.phase === 'vote') finishRound(room, now);
  else if (room.phase === 'reveal') startRound(room, room.round.number + 1, now);
  else return false;
  return true;
}

function removePlayer(room, playerId, now) {
  const player = room.players[playerId];
  if (!player) return false;
  const nextHostId = room.hostId === playerId ? playersIn(room).find(item => item.id !== playerId)?.id || null : room.hostId;
  room.departedPlayers[playerId] = { id: player.id, name: player.name, score: player.score, truthPicks: player.truthPicks };
  delete room.players[playerId];
  room.hostId = nextHostId;
  room.judgedIds = room.judgedIds.filter(id => id !== playerId);
  if (room.round) {
    delete room.round.fakes[playerId];
    delete room.round.votes[playerId];
    room.round.voteOrder = room.round.voteOrder.filter(ballot => ballot.playerId !== playerId);
    delete room.round.predictions[playerId];
    delete room.round.objections[playerId];
    if (room.round.judgeId === playerId) {
      room.round.judgeId = room.playersOrder.find(id => room.players[id] && !room.judgedIds.includes(id)) || room.hostId || playersIn(room)[0]?.id || null;
      if (room.round.judgeId && !room.judgedIds.includes(room.round.judgeId)) room.judgedIds.push(room.round.judgeId);
      delete room.round.fakes[room.round.judgeId];
      delete room.round.votes[room.round.judgeId];
      delete room.round.predictions[room.round.judgeId];
    }
    if (room.phase === 'vote') room.round.optionSet = optionsFor(room);
    const unjudged = playersIn(room).filter(item => !room.judgedIds.includes(item.id)).length;
    room.roundsTotal = Math.max(room.round.number, room.round.number + unjudged);
  }
  if (!Object.keys(room.players).length) { room.phase = 'ended'; room.deadline = 0; }
  else if (room.round && !['finished', 'ended'].includes(room.phase)) submitEveryone(room, now);
  return true;
}

function action(room, actionName, body, now = Date.now()) {
  const playerId = String(body.playerId || '');
  const name = String(body.name || '').trim().slice(0, 20);
  if (actionName === 'join') {
    if (room.phase === 'ended') return { status: 410, data: { error: 'This room has ended.' }, changed: false };
    if (!name) return { status: 400, data: { error: 'Enter a name to join.' }, changed: false };
    let existing = room.players[playerId];
    if (!existing) existing = playersIn(room).find(player => player.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (existing.name.toLowerCase() !== name.toLowerCase()) return { status: 409, data: { error: 'That saved seat belongs to a different name.' }, changed: false };
      const changed = now - existing.lastSeenAt >= 1_000;
      existing.lastSeenAt = now;
      return { status: 200, data: { code: room.code, playerId: existing.id, restored: true }, changed };
    }
    if (room.phase !== 'lobby') return { status: 409, data: { error: 'This game is already in progress.' }, changed: false };
    if (playersIn(room).length >= 8) return { status: 409, data: { error: 'This room is full.' }, changed: false };
    const id = playerId || crypto.randomUUID();
    room.players[id] = { id, name, score: 0, truthPicks: 0, objectionUsed: false, lastSeenAt: now };
    room.lastActivityAt = now;
    return { status: 200, data: { code: room.code, playerId: id, restored: false }, changed: true };
  }

  const actor = room.players[playerId];
  if (!actor) return { status: 403, data: { error: 'That seat is no longer in the room. Rejoin with the room code and name.' }, changed: false };
  actor.lastSeenAt = now;
  room.lastActivityAt = now;
  if (actionName === 'leave') {
    removePlayer(room, playerId, now);
    return { status: 200, data: { ok: true, hostId: room.hostId }, changed: true };
  }
  if (actionName === 'end') {
    if (actor.id !== room.hostId) return { status: 403, data: { error: 'Only the host can end the game.' }, changed: false };
    room.phase = 'ended'; room.deadline = 0;
    return { status: 200, data: { ok: true }, changed: true };
  }
  if (actionName === 'start' || actionName === 'replay') {
    const valid = actionName === 'start' ? room.phase === 'lobby' : room.phase === 'finished';
    if (actor.id !== room.hostId || !valid) return { status: 403, data: { error: actionName === 'start' ? 'Only the host can start the game.' : 'Only the host can start the next game.' }, changed: false };
    if (playersIn(room).length < 2) return { status: 409, data: { error: actionName === 'start' ? 'At least two players are needed.' : 'A new game cannot start right now.' }, changed: false };
    beginGame(room, now);
    return { status: 200, data: { ok: true }, changed: true };
  }
  if (actionName === 'advance') {
    if (actor.id !== room.hostId) return { status: 403, data: { error: 'Only the host can advance the phase.' }, changed: false };
    if (room.countdown.enabled) return { status: 409, data: { error: 'Manual advance is only available when Countdown is off.' }, changed: false };
    if (room.phase === 'writing') startVote(room, now);
    else if (room.phase === 'vote') finishRound(room, now);
    else if (room.phase === 'reveal') startRound(room, room.round.number + 1, now);
    else return { status: 409, data: { error: 'There is no phase to advance.' }, changed: false };
    return { status: 200, data: { ok: true }, changed: true };
  }

  const round = room.round;
  if (actionName === 'fake') {
    if (room.phase !== 'writing' || actor.id === round?.judgeId) return { status: 409, data: { error: 'You cannot submit a fake right now.' }, changed: false };
    const fake = String(body.text || '').trim();
    if (!fake) return { status: 400, data: { error: 'Enter a fake answer first.' }, changed: false };
    if (fake.length > 60) return { status: 400, data: { error: 'Fakes must be 60 characters or fewer.' }, changed: false };
    if (normalizeAnswer(fake) === normalizeAnswer(round.question.answer) || round.question.aliases?.some(alias => normalizeAnswer(fake) === normalizeAnswer(alias))) {
      return { status: 400, data: { error: 'Too close to the truth, try another' }, changed: false };
    }
    round.fakes[actor.id] = fake;
    submitEveryone(room, now);
    return { status: 200, data: { ok: true }, changed: true };
  }
  if (actionName === 'vote') {
    if (room.phase !== 'vote') return { status: 409, data: { error: 'Voting is closed.' }, changed: false };
    if (Object.hasOwn(round.votes, actor.id) || Object.hasOwn(round.predictions, actor.id)) return { status: 409, data: { error: 'You already submitted this round.' }, changed: false };
    const choiceId = String(body.answerId || '');
    const choice = round.optionSet?.find(option => option.id === choiceId);
    if (!choice) return { status: 400, data: { error: 'Choose one of the answers shown.' }, changed: false };
    if (actor.id === round.judgeId) {
      if (choice.type === 'truth') return { status: 400, data: { error: 'The Judge predicts a wrong answer, not the truth.' }, changed: false };
      round.predictions[actor.id] = choiceId;
    } else {
      if (choice.authorIds.includes(actor.id)) return { status: 400, data: { error: 'You cannot vote for a fake you wrote.' }, changed: false };
      let objection = null;
      if (body.objectionAnswerId) {
        if (actor.objectionUsed) return { status: 400, data: { error: 'You have already used your Objection this game.' }, changed: false };
        objection = round.optionSet.find(option => option.id === String(body.objectionAnswerId));
        if (!objection) return { status: 400, data: { error: 'Choose an answer to object to.' }, changed: false };
        if (objection.authorIds.includes(actor.id)) return { status: 400, data: { error: 'You cannot object to a fake you wrote.' }, changed: false };
      }
      round.votes[actor.id] = choiceId;
      round.voteOrder.push({ playerId: actor.id, optionId: choiceId, at: Number(body.receivedAt) || now });
      if (objection) { round.objections[actor.id] = objection.id; actor.objectionUsed = true; }
    }
    submitEveryone(room, now);
    return { status: 200, data: { ok: true }, changed: true };
  }
  return { status: 404, data: { error: 'Unknown action.' }, changed: false };
}

function validateCreate(body) {
  const name = String(body.name || '').trim().slice(0, 20);
  if (!name) return { error: 'Enter a name to create a room.' };
  const countdown = body.countdown || {};
  const durations = {
    fake: Number(countdown.durations?.fake ?? 45),
    vote: Number(countdown.durations?.vote ?? 30),
    reveal: Number(countdown.durations?.reveal ?? 15)
  };
  if (countdown.enabled && Object.values(durations).some(seconds => !Number.isInteger(seconds) || seconds < 10 || seconds > 180)) {
    return { error: 'Countdown phases must each be between 10 and 180 seconds.' };
  }
  return { name, countdown: { enabled: Boolean(countdown.enabled), durations } };
}

function isRoomExpired(room, now = Date.now()) {
  return now - room.lastActivityAt > ROOM_LIFETIME_MS;
}

module.exports = { action, advanceExpired, createRoom, isRoomExpired, makeSnapshot: snapshot, optionsFor, playersIn, validateCreate };
