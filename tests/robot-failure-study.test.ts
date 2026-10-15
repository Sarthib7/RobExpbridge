import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  episodeDigest,
  evaluate,
  joinKaggle,
  parseOriginal,
  runStudy,
  verifyManifestFile,
  type Episode,
  type Label,
} from '../scripts/robot-failure-study.js';

const originalUrl = new URL('../data/case-studies/robot-failures/lp1.data', import.meta.url);
const kaggleUrl = new URL('../data/case-studies/robot-failures/lp1_data.csv', import.meta.url);

async function loadEpisodes(): Promise<Episode[]> {
  return parseOriginal(await readFile(originalUrl, 'utf8'));
}

function syntheticEpisode(id: string, label: Label, base: number): Episode {
  const samples = Array.from({ length: 15 }, (_, row) => Array.from({ length: 6 }, (_, channel) => base + row + channel));
  return { id, label, samples, digest: episodeDigest(samples) };
}

function syntheticCsv(episodes: Episode[]): string {
  const rows = episodes.flatMap(episode => episode.samples).map(sample => sample.join(','));
  return ['column_a,column_b,column_c,column_d,column_e,column_f', ...rows].join('\n') + '\n';
}

test('source LP1 has 88 episodes and the frozen held-out result', async () => {
  const episodes = await loadEpisodes();
  const firstStudy = runStudy(episodes);
  const secondStudy = runStudy(episodes);
  const frozen = JSON.parse(await readFile(new URL('../data/evidence/robot-failure-case-study-20261015.json', import.meta.url), 'utf8'));
  assert.deepEqual(firstStudy.referenceIds, frozen.referenceIds);
  assert.deepEqual(firstStudy.queryIds, frozen.queryIds);
  const mapping = (values: typeof firstStudy.predictions) => values.map(({ queryId, truth, referenceId, prediction }) => ({ queryId, truth, referenceId, prediction }));
  assert.deepEqual(mapping(firstStudy.predictions), mapping(frozen.predictions));

  assert.equal(firstStudy.sourceCount, 88);
  assert.deepEqual(firstStudy.classCounts, { normal: 21, collision: 17, obstruction: 34, fr_collision: 16 });
  assert.equal(firstStudy.referenceCount, 68);
  assert.equal(firstStudy.queryCount, 20);
  assert.deepEqual(firstStudy.referenceIds, secondStudy.referenceIds);
  assert.deepEqual(firstStudy.queryIds, secondStudy.queryIds);
  assert.equal(firstStudy.retrieval.correct, 15);
  assert.equal(firstStudy.retrieval.total, 20);
  assert.equal(firstStudy.retrieval.accuracy, 0.75);
  assert.equal(firstStudy.retrieval.balancedAccuracy, 0.7410714285714286);
  assert.deepEqual(firstStudy.retrieval.confusion, {
    collision: { collision: 3, fr_collision: 0, normal: 1, obstruction: 0 },
    fr_collision: { collision: 0, fr_collision: 2, normal: 2, obstruction: 0 },
    normal: { collision: 0, fr_collision: 0, normal: 5, obstruction: 0 },
    obstruction: { collision: 0, fr_collision: 2, normal: 0, obstruction: 5 },
  });
  assert.equal(firstStudy.majorityBaseline.correct, 7);
  assert.equal(firstStudy.majorityBaseline.total, 20);
  assert.equal(firstStudy.majorityBaseline.accuracy, 0.35);
  assert.equal(firstStudy.majorityBaseline.balancedAccuracy, 0.25);
  assert.equal(firstStudy.falseNormalCount, 3);
  assert.equal(firstStudy.executionAuthority, false);
  assert.equal(firstStudy.recoveryOutcomesMeasured, false);
});

test('the Kaggle mirror joins only when every six-channel row matches in episode order', async () => {
  const episodes = await loadEpisodes();
  const csv = await readFile(kaggleUrl, 'utf8');
  assert.deepEqual(joinKaggle(csv, episodes), episodes);

  const lines = csv.trimEnd().split('\n');
  [lines[1], lines[2]] = [lines[2], lines[1]];
  assert.throws(() => joinKaggle(lines.join('\n'), episodes), /align/);
});

test('independent source corruption fails byte-count and digest checks', () => {
  const bytes = Buffer.from('source bytes');
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.throws(() => verifyManifestFile('lp1.data', bytes, { bytes: bytes.length + 1, sha256: digest }), /verification failed/);
  assert.throws(() => verifyManifestFile('lp1.data', bytes, { bytes: bytes.length, sha256: '0'.repeat(64) }), /verification failed/);
});

test('original source parser rejects bad episode boundaries and unsupported numeric values', () => {
  const rows = Array.from({ length: 15 }, (_, index) => `1 2 ${index} 4 5 6`);
  const valid = ['normal', ...rows].join('\n');
  assert.equal(parseOriginal(valid).length, 1);
  assert.throws(() => parseOriginal(['normal', ...rows.slice(1)].join('\n')), /fifteen/);
  assert.throws(() => parseOriginal(['normal', ...rows, '1 2 3 4 5 6'].join('\n')), /fifteen/);
  assert.throws(() => parseOriginal(valid.replace('1 2 0 4 5 6', '9007199254740992 2 0 4 5 6')), /safe range/);
  assert.throws(() => parseOriginal(valid.replace('1 2 0 4 5 6', '1.5 2 0 4 5 6')), /integer/);
  assert.throws(() => parseOriginal(valid.replace('normal', 'unknown')), /unsupported label/);
});

test('Kaggle join rejects invalid row boundaries, headers, and unsafe values', () => {
  const episodes = [syntheticEpisode('lp1-001', 'normal', 1)];
  const valid = syntheticCsv(episodes);
  assert.throws(() => joinKaggle(valid.replace('column_a,', 'wrong,'), episodes), /header/);
  assert.throws(() => joinKaggle(valid.replace('1,2,3,4,5,6\n', ''), episodes), /row count/);
  assert.throws(() => joinKaggle(valid.replace('1,2,3,4,5,6', '1,2,3,4,5'), episodes), /six/);
  assert.throws(() => joinKaggle(valid.replace('1,2,3,4,5,6', '9007199254740992,2,3,4,5,6'), episodes), /safe range/);
  assert.throws(() => joinKaggle(valid.replace('1,2,3,4,5,6', '1.5,2,3,4,5,6'), episodes), /integer/);
});

test('study rejects duplicate episode digests and reference-query overlap', () => {
  const labels: Label[] = ['collision', 'fr_collision', 'normal', 'obstruction'];
  const episodes = labels.flatMap((label, labelIndex) => Array.from({ length: 5 }, (_, index) =>
    syntheticEpisode(`lp1-${String(labelIndex * 5 + index + 1).padStart(3, '0')}`, label, labelIndex * 100 + index * 20)));
  const duplicated = { ...episodes[0], id: 'lp1-duplicate' };
  assert.throws(() => runStudy([...episodes, duplicated]), /duplicate episode digest/);

  const reference = episodes.slice(0, 4);
  assert.throws(() => evaluate(reference, [reference[0]]), /overlap/);
});

test('query labels cannot change reference scales or retrieved neighbors', async () => {
  const episodes = await loadEpisodes();
  const study = runStudy(episodes);
  const references = episodes.filter(episode => study.referenceIds.includes(episode.id));
  const queries = episodes.filter(episode => study.queryIds.includes(episode.id));
  const original = evaluate(references, queries);
  const relabeled = evaluate(references, queries.map(query => ({
    ...query,
    label: ({ collision: 'fr_collision', fr_collision: 'normal', normal: 'obstruction', obstruction: 'collision' } as const)[query.label],
  })));

  assert.deepEqual(relabeled.scalesFromReferenceOnly, original.scalesFromReferenceOnly);
  assert.deepEqual(relabeled.predictions.map(({ queryId, referenceId, referenceDigest, prediction, squaredDistance }) => ({ queryId, referenceId, referenceDigest, prediction, squaredDistance })),
    original.predictions.map(({ queryId, referenceId, referenceDigest, prediction, squaredDistance }) => ({ queryId, referenceId, referenceDigest, prediction, squaredDistance })));
});

test('query traces do not change channel scales computed from references', async () => {
  const episodes = await loadEpisodes();
  const study = runStudy(episodes);
  const references = episodes.filter(episode => study.referenceIds.includes(episode.id));
  const queries = episodes.filter(episode => study.queryIds.includes(episode.id));
  const original = evaluate(references, queries);
  const changed = queries.map((query, index) => {
    if (index !== 0) return query;
    const samples = query.samples.map(row => row.map(value => value + 1_000_000));
    return { ...query, samples, digest: episodeDigest(samples) };
  });

  assert.deepEqual(evaluate(references, changed).scalesFromReferenceOnly, original.scalesFromReferenceOnly);
});
