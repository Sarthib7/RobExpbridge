import { z } from 'zod';
import { LP1_LABELS } from './robot-failure-study.js';

const count = z.number().int().nonnegative();
const metrics = z.object({ correct: count, total: count.positive() });
const reportSchema = z.object({
  sourceCount: count.positive(), referenceCount: count.positive(), queryCount: count.positive(),
  retrieval: metrics, majorityBaseline: metrics, falseNormalCount: count,
  predictions: z.array(z.object({ truth: z.enum(LP1_LABELS), prediction: z.enum(LP1_LABELS), majorityPrediction: z.enum(LP1_LABELS) })),
  executionAuthority: z.literal(false), recoveryOutcomesMeasured: z.literal(false),
}).refine(r => r.referenceCount + r.queryCount === r.sourceCount
  && r.retrieval.total === r.queryCount && r.majorityBaseline.total === r.queryCount
  && r.retrieval.correct <= r.queryCount && r.majorityBaseline.correct <= r.queryCount
  && r.predictions.length === r.queryCount
  && r.retrieval.correct === r.predictions.filter(p => p.truth === p.prediction).length
  && r.majorityBaseline.correct === r.predictions.filter(p => p.truth === p.majorityPrediction).length
  && r.falseNormalCount === r.predictions.filter(p => p.truth !== 'normal' && p.prediction === 'normal').length, 'Inconsistent case-study counts');

export function renderPublicCaseStudy(input: unknown): string {
  const r = reportSchema.parse(input);
  const percent = (correct: number) => `${Math.round(correct / r.queryCount * 100)}%`;
  return `<section id="case-study" class="panel case-study" aria-labelledby="case-study-heading">
    <div class="panel-heading"><div><p class="eyebrow">RECORDED DATA / OFFLINE DIAGNOSIS</p><h2 id="case-study-heading">Can memory find a similar failure?</h2></div><span class="panel-tag">Exploratory study</span></div>
    <p>Kaggle/UCI LP1 contains ${r.sourceCount} recorded force/torque traces. We kept ${r.referenceCount} as reference memory and held out ${r.queryCount} whole recordings.</p>
    <table class="study-results"><caption>Correct failure labels on the fixed ${r.queryCount}-query split</caption><thead><tr><th scope="col">Method</th><th scope="col">Correct labels</th><th scope="col">Accuracy</th></tr></thead><tbody><tr><th scope="row">Similar-failure retrieval</th><td>${r.retrieval.correct} / ${r.queryCount}</td><td>${percent(r.retrieval.correct)}</td></tr><tr><th scope="row">Reference-majority baseline</th><td>${r.majorityBaseline.correct} / ${r.queryCount}</td><td>${percent(r.majorityBaseline.correct)}</td></tr></tbody></table>
    <div class="study-limit"><strong>${r.falseNormalCount} faulty traces were labeled normal.</strong><p>Measurements start after failure detection. This tests diagnosis, not recovery success or pre-failure prediction. One dataset cannot establish transfer across robots or sites, or robot safety. These recordings stay outside the paid advisory path.</p></div>
    <details class="study-method"><summary>Method, diagram and sources</summary>
    <figure class="study-diagram"><figcaption>How the recorded-data test runs</figcaption><ol class="study-flow"><li><strong>Recorded signals</strong><span>Kaggle sensor rows + original UCI labels</span></li><li><strong>Verify and split</strong><span>Check source hashes and row alignment<br>${r.referenceCount} references / ${r.queryCount} queries</span></li><li><strong>Retrieve a reference</strong><span>Reference-only channel scales<br>Nearest trace by signal distance</span></li><li><strong>Check the label</strong><span>${r.retrieval.correct} correct / ${r.queryCount - r.retrieval.correct} wrong</span></li></ol></figure>
    <p class="small">Original data: UCI Robot Execution Failures (CC BY 4.0), by Luis Seabra Lopes and Luis M. Camarinha-Matos. Kaggle mirror: prashant111, version 1. The manifest records the license metadata difference.</p>
    <div class="study-links"><a href="https://github.com/Sarthib7/RobExpbridge/blob/main/docs/case-studies/robot-failures.md">Full method and all ${r.queryCount - r.retrieval.correct} errors ↗</a><a href="/data/evidence/robot-failure-case-study-20261015.json">Raw prediction report</a><a href="/data/case-studies/robot-failures/manifest.json">Source manifest</a></div>
    <p class="small">Reproduce offline: <code>npm run case-study:robot</code>. No wallet, payment or robot control.</p>
    </details>
  </section>`;
}
