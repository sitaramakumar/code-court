import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { unzipSync } from 'fflate';

const tempFunctionFolder = await mkdtemp(join(tmpdir(), 'code-court-function-'));
const packagedFunctionPath = join(tempFunctionFolder, 'game.cjs');
const packedFunctionZip = unzipSync(await readFile(new URL('../artifacts/netlify-function.zip', import.meta.url)));
assert.deepEqual(Object.keys(packedFunctionZip), ['game.cjs']);
await writeFile(packagedFunctionPath, packedFunctionZip['game.cjs']);
const { createGameHandler } = createRequire(packagedFunctionPath)(packagedFunctionPath);
after(() => rm(tempFunctionFolder, { recursive: true, force: true }));

class MemoryBlobs {
  blobs = new Map();
  etagNumber = 0;

  async getWithMetadata(key, options = {}) {
    const current = this.blobs.get(key);
    if (!current) return null;
    return { data: structuredClone(current.data), etag: current.etag, metadata: {}, consistency: options.consistency };
  }

  async setJSON(key, value, options = {}) {
    const current = this.blobs.get(key);
    if (options.onlyIfNew && current) return { modified: false };
    if (options.onlyIfMatch && options.onlyIfMatch !== current?.etag) return { modified: false };
    const etag = `"blob-${++this.etagNumber}"`;
    this.blobs.set(key, { data: structuredClone(value), etag });
    return { modified: true, etag };
  }
}

function createClient(handler) {
  async function get(code, playerId) {
    const query = new URLSearchParams({ action: 'state', code, playerId });
    const response = await handler(new Request(`https://game.test/.netlify/functions/game?${query}`));
    const data = await response.json();
    assert.equal(response.ok, true, JSON.stringify(data));
    return data;
  }

  async function post(action, body = {}) {
    const response = await handler(new Request('https://game.test/.netlify/functions/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, action })
    }));
    const data = await response.json();
    assert.equal(response.ok, true, `${action} returned ${response.status}: ${JSON.stringify(data)}`);
    return data;
  }

  return { get, post };
}

test('three-round two-player game scores truth, speed and Judge prediction, then names a winner', async () => {
  const store = new MemoryBlobs();
  const handler = createGameHandler(() => store);
  const client = createClient(handler);
  const hostId = 'sitarama-seat';
  const otherId = 'second-seat';
  const { code } = await client.post('create', {
    name: 'Sitarama Kumar Mokkapati',
    mode: 'developer',
    playerId: hostId,
    countdown: { enabled: false, durations: { fake: 45, vote: 30, reveal: 15 } }
  });
  await client.post('join', { code, playerId: otherId, name: 'Second player' });
  await client.post('start', { code, playerId: hostId });

  let firstJudgeId = null;
  const contestantRounds = new Map([[hostId, 0], [otherId, 0]]);
  let truthRounds = 0;
  let speedAwards = 0;
  let judgeBonusRounds = 0;

  for (let roundIndex = 0; roundIndex < 3; roundIndex++) {
    let hostView = await client.get(code, hostId);
    let otherView = await client.get(code, otherId);
    assert.equal(hostView.phase, 'writing');
    assert.equal(otherView.phase, 'writing');
    assert.equal(hostView.roundNumber, roundIndex + 1);
    const judgeId = hostView.judgeId;
    if (roundIndex === 0) firstJudgeId = judgeId;
    assert.equal(otherView.judgeId, judgeId);
    const contestantId = judgeId === hostId ? otherId : hostId;
    contestantRounds.set(contestantId, contestantRounds.get(contestantId) + 1);
    const judgeView = judgeId === hostId ? hostView : otherView;
    let contestantView = contestantId === hostId ? hostView : otherView;
    assert.equal(Boolean(judgeView.question.truth), true);
    assert.equal(judgeView.question.suggestions, undefined);
    assert.equal(contestantView.question.suggestions.length, 2);
    assert.equal(contestantView.question.truth, undefined);

    const fake = `A plausible courtroom fake ${roundIndex + 1}`;
    await client.post('fake', { code, playerId: contestantId, text: fake });
    contestantView = await client.get(code, contestantId);
    const updatedJudgeView = await client.get(code, judgeId);
    assert.equal(contestantView.phase, 'vote');
    assert.equal(updatedJudgeView.phase, 'vote');
    assert.equal(updatedJudgeView.question.suggestions, undefined);

    const savedRoom = store.blobs.get(code).data;
    const truth = savedRoom.round.question.answer;
    const contestantTruth = contestantView.options.find(option => option.text === truth);
    assert.ok(contestantTruth, 'the true answer is in the contestant ballot');
    const wrongOption = contestantView.options.find(option => option.id !== contestantTruth.id && !option.ownFake);
    assert.ok(wrongOption, 'there is a wrong answer available for the Judge prediction');

    // The first ballot is a deliberate bluff to exercise the +2 Judge prediction.
    const ballot = roundIndex === 0 ? wrongOption : contestantTruth;
    await client.post('vote', { code, playerId: contestantId, answerId: ballot.id, receivedAt: Date.now() });
    await client.post('vote', { code, playerId: judgeId, answerId: wrongOption.id });
    const reveal = await client.get(code, hostId);
    assert.equal(reveal.phase, 'reveal');
    assert.ok(reveal.reveal.options.some(option => option.type === 'decoy' && option.reason), 'house decoys carry their explanation');
    if (roundIndex === 0) {
      assert.equal(reveal.reveal.judgePredictionRight, true);
      judgeBonusRounds++;
    } else {
      assert.equal(reveal.reveal.fastestPlayerId, contestantId);
      assert.equal(reveal.reveal.scoreDeltas[contestantId], 4);
      speedAwards++;
      truthRounds++;
    }

    const hostState = await client.get(code, hostId);
    await client.post('advance', { code, playerId: hostState.hostId });
  }

  const final = await client.get(code, hostId);
  assert.equal(final.phase, 'finished');
  assert.equal(final.roundsTotal, 3);
  assert.equal(truthRounds, 2);
  assert.equal(speedAwards, 2);
  assert.equal(judgeBonusRounds, 1);
  assert.equal(contestantRounds.get(firstJudgeId), 1);
  assert.equal(contestantRounds.get(firstJudgeId === hostId ? otherId : hostId), 2);
  assert.equal(final.final.players[0].id, firstJudgeId, 'the repeated Judge earns the +2 that wins');
  assert.deepEqual(final.final.players.map(player => player.score), [6, 4]);
  assert.deepEqual(final.final.winners, [firstJudgeId]);
});

test('frontend calls the direct Netlify Function endpoint and has no API redirect or config.path', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const functionSource = await readFile(new URL('../netlify/functions/game.ts', import.meta.url), 'utf8');
  const netlifyConfig = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.match(app, /\.netlify\/functions\/game/);
  assert.doesNotMatch(app, /\/api\/game|EventSource/);
  assert.match(functionSource, /consistency:\s*["']strong["']/);
  assert.match(functionSource, /onlyIfMatch|onlyIfNew/);
  assert.doesNotMatch(functionSource, /config\s*:\s*\{[^}]*path/s);
  assert.doesNotMatch(netlifyConfig, /\/api\/game/);
});
