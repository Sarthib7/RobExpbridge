import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const LP1_LABELS = ['collision', 'fr_collision', 'normal', 'obstruction'] as const;
export type Label = (typeof LP1_LABELS)[number];
export type Episode = {
  id: string;
  label: Label;
  samples: number[][];
  digest: string;
};

const SAMPLE_COUNT = 15;
const CHANNEL_COUNT = 6;
const CHANNELS = ['Fx', 'Fy', 'Fz', 'Tx', 'Ty', 'Tz'] as const;
const LABEL_SET = new Set<string>(LP1_LABELS);
const CSV_HEADER = 'column_a,column_b,column_c,column_d,column_e,column_f';

export type Prediction = {
  queryId: string;
  queryDigest: string;
  truth: Label;
  referenceId: string;
  referenceDigest: string;
  prediction: Label;
  squaredDistance: number;
  majorityPrediction: Label;
};

export type Metrics = {
  correct: number;
  total: number;
  accuracy: number;
  perClassRecall: Record<string, number>;
  balancedAccuracy: number;
  confusion: Record<string, Record<string, number>>;
};

export type Evaluation = {
  scalesFromReferenceOnly: number[];
  retrieval: Metrics;
  majorityBaseline: Metrics;
  predictions: Prediction[];
  falseNormalCount: number;
};

export function episodeDigest(samples: number[][]): string {
  return createHash('sha256').update(JSON.stringify(samples)).digest('hex');
}

function fail(message: string): never {
  throw new Error(message);
}

function parseInteger(token: string): number {
  if (!/^[+-]?\d+$/.test(token)) fail('invalid integer value');
  const value = Number(token);
  if (!Number.isSafeInteger(value)) fail('integer value is outside the safe range');
  return value;
}

function parseSampleLine(line: string): number[] {
  const fields = line.trim().split(/\s+/);
  if (fields.length !== CHANNEL_COUNT) fail('episode row must contain six integer values');
  return fields.map(parseInteger);
}

export function parseOriginal(text: string): Episode[] {
  if (typeof text !== 'string' || text.trim().length === 0) fail('LP1 source is empty');
  const blocks = text.trim().split(/\r?\n[\t ]*\r?\n/).map(block => block.trim()).filter(Boolean);
  if (blocks.length === 0) fail('LP1 source has no episodes');

  return blocks.map((block, index) => {
    const lines = block.split(/\r?\n/).map(line => line.trim());
    const label = lines[0];
    if (!LABEL_SET.has(label)) fail('LP1 episode has an unsupported label');
    if (lines.length !== SAMPLE_COUNT + 1) fail('LP1 episode must contain fifteen sample rows');
    const samples = lines.slice(1).map(parseSampleLine);
    return {
      id: `lp1-${String(index + 1).padStart(3, '0')}`,
      label: label as Label,
      samples,
      digest: episodeDigest(samples),
    };
  });
}

function validateEpisode(value: unknown): Episode {
  if (!value || typeof value !== 'object') fail('invalid episode record');
  const episode = value as Partial<Episode>;
  if (typeof episode.id !== 'string' || episode.id.length === 0 || episode.id.length > 100) fail('invalid episode ID');
  if (typeof episode.label !== 'string' || !LABEL_SET.has(episode.label)) fail('unsupported episode label');
  if (!Array.isArray(episode.samples) || episode.samples.length !== SAMPLE_COUNT) fail('episode must contain fifteen sample rows');
  for (const row of episode.samples) {
    if (!Array.isArray(row) || row.length !== CHANNEL_COUNT) fail('episode row must contain six integer values');
    for (const value of row) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail('episode values must be safe integers');
    }
  }
  if (typeof episode.digest !== 'string' || !/^[a-f0-9]{64}$/.test(episode.digest)) fail('invalid episode digest');
  if (episode.digest !== episodeDigest(episode.samples as number[][])) fail('episode digest does not match its samples');
  return episode as Episode;
}

function validateEpisodes(values: unknown): Episode[] {
  if (!Array.isArray(values) || values.length === 0) fail('episode list is empty');
  const episodes = values.map(validateEpisode);
  const ids = new Set<string>();
  const digests = new Set<string>();
  for (const episode of episodes) {
    if (ids.has(episode.id)) fail('duplicate episode ID');
    if (digests.has(episode.digest)) fail('duplicate episode digest');
    ids.add(episode.id);
    digests.add(episode.digest);
  }
  return episodes;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseCsvInteger(token: string): number {
  return parseInteger(token.trim());
}

export function joinKaggle(csv: string, episodesInput: Episode[]): Episode[] {
  if (typeof csv !== 'string' || csv.length === 0) fail('Kaggle CSV is empty');
  const episodes = validateEpisodes(episodesInput);
  const lines = csv.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0 || lines[0] !== CSV_HEADER) fail('Kaggle CSV header does not match');
  if (lines.slice(1).some(line => line.length === 0)) fail('Kaggle CSV contains an empty row');
  if (lines.length - 1 !== episodes.length * SAMPLE_COUNT) fail('Kaggle CSV row count does not match LP1 episodes');

  const expectedRows = episodes.flatMap(episode => episode.samples);
  for (let index = 1; index < lines.length; index += 1) {
    const fields = lines[index].split(',');
    if (fields.length !== CHANNEL_COUNT) fail('Kaggle CSV row must contain six integer values');
    const actual = fields.map(parseCsvInteger);
    const expected = expectedRows[index - 1];
    if (actual.some((value, channel) => value !== expected[channel])) fail('Kaggle CSV does not align with the original LP1 traces');
  }
  return episodes;
}

function channelScales(references: Episode[]): number[] {
  return CHANNELS.map((_, channel) => {
    const values = references.flatMap(episode => episode.samples.map(sample => sample[channel]));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    return standardDeviation === 0 ? 1 : standardDeviation;
  });
}

function majorityLabel(references: Episode[]): Label {
  const counts = new Map<Label, number>();
  for (const episode of references) counts.set(episode.label, (counts.get(episode.label) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || compareText(left[0], right[0]))[0][0];
}

function distanceSquared(query: Episode, reference: Episode, scales: number[]): number {
  let distance = 0;
  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
      const difference = (query.samples[sample][channel] - reference.samples[sample][channel]) / scales[channel];
      distance += difference * difference;
    }
  }
  return distance;
}

function metrics(predictions: Prediction[], predictedLabel: (prediction: Prediction) => Label): Metrics {
  if (predictions.length === 0) fail('evaluation has no query episodes');
  const actualLabels = [...new Set(predictions.map(prediction => prediction.truth))].sort(compareText);
  const confusion: Record<string, Record<string, number>> = {};
  for (const actual of actualLabels) {
    confusion[actual] = Object.fromEntries(LP1_LABELS.map(label => [label, 0]));
  }
  let correct = 0;
  for (const prediction of predictions) {
    const predicted = predictedLabel(prediction);
    confusion[prediction.truth][predicted] += 1;
    if (prediction.truth === predicted) correct += 1;
  }
  const perClassRecall: Record<string, number> = {};
  for (const label of actualLabels) {
    const total = Object.values(confusion[label]).reduce((sum, value) => sum + value, 0);
    perClassRecall[label] = total === 0 ? 0 : confusion[label][label] / total;
  }
  const recalls = Object.values(perClassRecall);
  return {
    correct,
    total: predictions.length,
    accuracy: correct / predictions.length,
    perClassRecall,
    balancedAccuracy: recalls.reduce((sum, value) => sum + value, 0) / recalls.length,
    confusion,
  };
}

export function evaluate(referenceInput: Episode[], queryInput: Episode[]): Evaluation {
  const references = validateEpisodes(referenceInput).sort((left, right) => compareText(left.id, right.id));
  const queries = validateEpisodes(queryInput).sort((left, right) => compareText(left.id, right.id));
  const allIds = new Set(references.map(episode => episode.id));
  const allDigests = new Set(references.map(episode => episode.digest));
  for (const query of queries) {
    if (allIds.has(query.id)) fail('reference and query episode IDs overlap');
    if (allDigests.has(query.digest)) fail('reference and query episode digests overlap');
  }

  const scales = channelScales(references);
  const majority = majorityLabel(references);
  const predictions = queries.map(query => {
    let nearest = references[0];
    let nearestDistance = distanceSquared(query, nearest, scales);
    for (const reference of references.slice(1)) {
      const distance = distanceSquared(query, reference, scales);
      if (distance < nearestDistance || (distance === nearestDistance && compareText(reference.id, nearest.id) < 0)) {
        nearest = reference;
        nearestDistance = distance;
      }
    }
    return {
      queryId: query.id,
      queryDigest: query.digest,
      truth: query.label,
      referenceId: nearest.id,
      referenceDigest: nearest.digest,
      prediction: nearest.label,
      squaredDistance: nearestDistance,
      majorityPrediction: majority,
    };
  });
  return {
    scalesFromReferenceOnly: scales,
    retrieval: metrics(predictions, prediction => prediction.prediction),
    majorityBaseline: metrics(predictions, prediction => prediction.majorityPrediction),
    predictions,
    falseNormalCount: predictions.filter(prediction => prediction.truth !== 'normal' && prediction.prediction === 'normal').length,
  };
}

export function runStudy(episodeInput: Episode[]): Omit<Evaluation, 'scalesFromReferenceOnly'> & {
  sourceCount: number;
  classCounts: Record<string, number>;
  referenceCount: number;
  queryCount: number;
  referenceIds: string[];
  queryIds: string[];
  scalesFromReferenceOnly: number[];
  executionAuthority: false;
  recoveryOutcomesMeasured: false;
} {
  const episodes = validateEpisodes(episodeInput);
  const sourceLabels = [...new Set(episodes.map(episode => episode.label))].sort(compareText);
  if (sourceLabels.length !== LP1_LABELS.length || LP1_LABELS.some(label => !sourceLabels.includes(label))) {
    fail('LP1 study requires all four source labels');
  }

  const references: Episode[] = [];
  const queries: Episode[] = [];
  for (const label of sourceLabels) {
    const group = episodes.filter(episode => episode.label === label).sort((left, right) => compareText(left.digest, right.digest));
    const queryCount = Math.ceil(group.length / 5);
    if (queryCount >= group.length) fail('each class must retain a reference episode');
    queries.push(...group.slice(0, queryCount));
    references.push(...group.slice(queryCount));
  }
  references.sort((left, right) => compareText(left.id, right.id));
  queries.sort((left, right) => compareText(left.id, right.id));

  const evaluation = evaluate(references, queries);
  const classCounts: Record<string, number> = {};
  for (const episode of episodes) classCounts[episode.label] = (classCounts[episode.label] ?? 0) + 1;
  return {
    sourceCount: episodes.length,
    classCounts,
    referenceCount: references.length,
    queryCount: queries.length,
    referenceIds: references.map(episode => episode.id),
    queryIds: queries.map(episode => episode.id),
    ...evaluation,
    executionAuthority: false,
    recoveryOutcomesMeasured: false,
  };
}

export function verifyManifestFile(fileName: string, bytes: Uint8Array, expected: unknown): { bytes: number; sha256: string } {
  if (!fileName || !bytes || !(bytes instanceof Uint8Array) || !expected || typeof expected !== 'object') {
    fail('invalid source file manifest entry');
  }
  const entry = expected as { bytes?: unknown; sha256?: unknown };
  if (!Number.isSafeInteger(entry.bytes) || (entry.bytes as number) < 0 || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
    fail('invalid source file manifest entry');
  }
  const actual = {
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  if (entry.bytes !== actual.bytes || entry.sha256 !== actual.sha256) fail(`source file verification failed: ${fileName}`);
  return actual;
}

type Manifest = {
  dataset: string;
  authors: string[];
  originalSource: string;
  doi: string;
  kaggleSource: string;
  kaggleVersion: number;
  files: Record<string, unknown>;
  rights: {
    license: string;
    licenseUrl: string;
    basis: string;
    kaggleCatalogLicense: string;
    licenseDifference: string;
  };
  sampling: {
    episodes: number;
    samplesPerEpisode: number;
    channels: string[];
    windowMs: number;
    units: string;
    timing: string;
  };
  protocol: Record<string, unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseManifest(value: unknown): Manifest {
  if (!isObject(value) || !isObject(value.files) || !isObject(value.rights) || !isObject(value.sampling) || !isObject(value.protocol)) {
    fail('invalid dataset manifest');
  }
  const authors = value.authors;
  const rights = value.rights;
  const sampling = value.sampling;
  if (!Array.isArray(authors) || authors.length === 0 || !authors.every(requiredString)) fail('invalid dataset manifest');
  if (!requiredString(value.dataset) || !requiredString(value.originalSource) || !requiredString(value.doi) || !requiredString(value.kaggleSource)) fail('invalid dataset manifest');
  if (!Number.isSafeInteger(value.kaggleVersion) || (value.kaggleVersion as number) < 1) fail('invalid dataset manifest');
  if (!requiredString(rights.license) || !requiredString(rights.licenseUrl) || !requiredString(rights.basis) || !requiredString(rights.kaggleCatalogLicense) || !requiredString(rights.licenseDifference)) fail('invalid dataset manifest');
  if (!Number.isSafeInteger(sampling.episodes) || !Number.isSafeInteger(sampling.samplesPerEpisode) || !Number.isSafeInteger(sampling.windowMs)) fail('invalid dataset manifest');
  if (!Array.isArray(sampling.channels) || !sampling.channels.every(requiredString) || !requiredString(sampling.units) || !requiredString(sampling.timing)) fail('invalid dataset manifest');
  return value as unknown as Manifest;
}

const FROZEN_PROTOCOL = {
  scope: 'LP1 only: offline diagnosis retrieval, not recovery or pre-failure prediction',
  source: 'prashant111/robot-execution-failures',
  kaggleVersion: 1,
  original: 'UCI Robot Execution Failures, DOI 10.24432/C5M89N',
  split: 'Within each original label, sort episodes by SHA256 of canonical integer samples; first ceil(classCount/5) are queries. Remaining episodes are reference memory. No window-level split.',
  features: 'All 90 raw values; channel scale is population standard deviation across reference-memory samples only. Zero scale becomes 1. No tuning.',
  retrieval: 'One nearest reference episode by squared Euclidean distance after channel scaling. Equal distance ties resolve by source episode index.',
  baseline: 'Majority label in reference memory; equal counts resolve lexicographically.',
  metrics: ['correct/queries', 'accuracy', 'per-class recall', 'balanced accuracy', 'confusion counts'],
  limits: ['Small same-source, post-detection recordings', 'No recovery outcome labels', 'No verified hardware compatibility metadata', 'No physical control or new payments'],
  frozenAt: '2026-10-15T10:09:09.635540+00:00',
};

function assertFrozenProtocol(protocol: Record<string, unknown>): void {
  const keys = Object.keys(FROZEN_PROTOCOL);
  if (keys.length !== Object.keys(protocol).length || keys.some(key => JSON.stringify(protocol[key]) !== JSON.stringify(FROZEN_PROTOCOL[key as keyof typeof FROZEN_PROTOCOL]))) {
    fail('dataset manifest protocol does not match the frozen study');
  }
}

async function runCli(): Promise<void> {
  const dataDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../data/case-studies/robot-failures');
  const manifestText = await readFile(resolve(dataDirectory, 'manifest.json'), 'utf8');
  const manifest = parseManifest(JSON.parse(manifestText));
  assertFrozenProtocol(manifest.protocol);

  const [originalBytes, kaggleBytes] = await Promise.all([
    readFile(resolve(dataDirectory, 'lp1.data')),
    readFile(resolve(dataDirectory, 'lp1_data.csv')),
  ]);
  const originalIntegrity = verifyManifestFile('lp1.data', originalBytes, manifest.files['lp1.data']);
  const kaggleIntegrity = verifyManifestFile('lp1_data.csv', kaggleBytes, manifest.files['lp1_data.csv']);
  const episodes = parseOriginal(originalBytes.toString('utf8'));
  joinKaggle(kaggleBytes.toString('utf8'), episodes);
  if (episodes.length !== manifest.sampling.episodes || episodes.some(episode => episode.samples.length !== manifest.sampling.samplesPerEpisode)) {
    fail('source episode shape does not match the manifest');
  }

  const study = runStudy(episodes);
  const sourceAttribution = {
    dataset: manifest.dataset,
    authors: manifest.authors,
    originalSource: manifest.originalSource,
    doi: manifest.doi,
    kaggleSource: manifest.kaggleSource,
    kaggleVersion: manifest.kaggleVersion,
    license: manifest.rights.license,
    licenseUrl: manifest.rights.licenseUrl,
    rightsBasis: manifest.rights.basis,
    kaggleCatalogLicense: manifest.rights.kaggleCatalogLicense,
    licenseDifference: manifest.rights.licenseDifference,
  };
  const report = {
    provenance: 'VERIFIED',
    command: 'node --import tsx scripts/robot-failure-study.ts',
    observedAt: new Date().toISOString(),
    protocol: manifest.protocol,
    sourceAttribution,
    sampling: manifest.sampling,
    sourceFileIntegrity: { 'lp1.data': originalIntegrity, 'lp1_data.csv': kaggleIntegrity },
    ...study,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch(() => {
    process.stderr.write('robot-failure-study: dataset verification or evaluation failed\n');
    process.exitCode = 1;
  });
}
