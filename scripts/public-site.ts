const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function siteHeader(current: 'demo' | 'showcases' | 'study' | 'evidence'): string {
  const active = (page: string) => current === page ? ' aria-current="page"' : '';
  return `<header class="site-header">
    <div class="site-header-inner">
      <div class="site-identity"><a class="site-product" href="/" aria-label="exbridge home">exbridge<span>Machine experience exchange</span></a><a class="site-maker" href="https://noesora.xyz" aria-label="Noesora home"><svg viewBox="0 0 96 96" aria-hidden="true" focusable="false"><path d="M30 16H16V80H30M66 16H80V80H66M30 70L66 26" fill="none" stroke="currentColor" stroke-width="6"/><rect x="45" y="45" width="6" height="6" fill="currentColor"/></svg><span>by Noesora ↗</span></a></div>
      <nav class="site-nav" aria-label="Main navigation">
        <a href="/showcases"${active('showcases')}>Showcases</a>
        <a id="case-study-link" href="/case-study"${active('study')}>Case study</a>
        <a id="evidence-link" href="/evidence"${active('evidence')}>Evidence</a>
        <a class="site-demo-link" href="/#demo"${active('demo')}>Try demo <span aria-hidden="true">↗</span></a>
      </nav>
    </div>
  </header>`;
}

const footer = `<footer class="footer-note"><span>exbridge / A Noesora product</span><a href="https://github.com/Sarthib7/RobExpbridge">Source code ↗</a></footer>`;

function page(title: string, description: string, current: 'showcases' | 'study' | 'evidence', content: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#080b0d"><meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(title)} | exbridge</title><link rel="stylesheet" href="/styles.css"></head><body class="public-preview showcase-page"><a class="skip-link" href="#main">Skip to content</a>${siteHeader(current)}<main id="main" tabindex="-1">${content}${footer}</main></body></html>`;
}

export function renderShowcases(): string {
  return page('Showcases', 'Explore the constructed recovery demo and the recorded robot-failure diagnosis study.', 'showcases', `
    <div class="showcase-intro"><p class="site-eyebrow">EXPLORE EXBRIDGE</p><h1>Two ways to test shared memory.</h1><p class="lede">Try a recovery in a constructed fixture. Then inspect a diagnosis test with recorded sensor data.</p></div>
    <div class="showcase-grid">
      <article class="showcase-card"><div class="showcase-art recovery-art" aria-hidden="true"><svg viewBox="0 0 440 220"><path class="art-grid" d="M20 180H420M70 30V190M170 30V190M270 30V190M370 30V190"/><path class="art-arm" d="M95 175V110l65-55 65 48"/><circle cx="95" cy="110" r="9"/><circle cx="160" cy="55" r="9"/><circle cx="225" cy="103" r="8"/><path class="art-gripper" d="M225 112v13m-10 0h20m-20 0v15m20-15v15"/><path class="art-fixture" d="M195 180v-20h60v20"/><path class="art-memory" d="M284 60q65 0 65 66"/><path class="art-memory" d="m340 117 9 10 9-10"/><text x="279" y="48">SHARED LESSON</text><text x="292" y="158">CHECK → TRY</text></svg></div><div class="showcase-copy"><p class="site-eyebrow">01 / CONSTRUCTED SIMULATION</p><h2>A lesson at the fixture</h2><p>Measure a slip, check the receiving gripper, and try the lower-force advisory in the same fixture.</p><p class="showcase-limit">Synthetic outcomes. No physical robot or payment.</p><a class="showcase-link" href="/#demo">Run the recovery demo <span aria-hidden="true">↗</span></a></div></article>
      <article class="showcase-card"><div class="showcase-art study-art" aria-hidden="true"><svg viewBox="0 0 440 220"><rect x="35" y="45" width="150" height="125" rx="8"/><path class="art-records" d="M55 70h110M55 90h110M55 110h110M55 130h110M55 150h70"/><path class="art-memory" d="M195 105h55m-10-9 10 9-10 9"/><rect x="265" y="65" width="140" height="85" rx="8"/><text x="54" y="198">RECORDED TRACES</text><text x="284" y="104">SIMILAR</text><text x="284" y="125">FAILURE?</text></svg></div><div class="showcase-copy"><p class="site-eyebrow">02 / RECORDED DATA</p><h2>Find a similar failure</h2><p>Compare a held-out sensor trace with reference recordings from Kaggle/UCI Robot Execution Failures.</p><p class="showcase-limit">Post-failure diagnosis. Recovery success was not measured.</p><a class="showcase-link" href="/case-study">Read the case study <span aria-hidden="true">↗</span></a></div></article>
    </div><aside class="showcase-boundary"><h2>Read each result with its limits.</h2><p>The demo tests a constructed recovery path. The study tests diagnosis on one fixed dataset split. Neither establishes physical robot safety.</p><a href="/evidence">Inspect the run evidence ↗</a></aside>`);
}

export function renderStudyPage(study: string): string {
  return page('Recorded failure case study', 'Results, errors and method for the Kaggle/UCI robot-failure diagnosis test.', 'study', `<a class="back-link" href="/showcases">← All showcases</a><div class="showcase-intro"><p class="site-eyebrow">CASE STUDY / KAGGLE + UCI</p><h1>Find a similar recorded failure.</h1><p class="lede">An offline diagnosis test with force and torque recordings. Read the results alongside the errors and source data.</p></div>${study}`);
}

export function renderEvidencePage(evidence: string): string {
  return page('Run evidence', 'Recorded run evidence and integration limits for exbridge.', 'evidence', `<a class="back-link" href="/showcases">← All showcases</a><div class="showcase-intro"><p class="site-eyebrow">RECORDED RUNS</p><h1>Inspect the evidence.</h1><p class="lede">This is the repository’s recorded evidence document. Dates and integration checks describe those runs, not a live network check.</p><a class="showcase-link" href="/evidence.md">Open raw Markdown ↗</a></div><pre class="evidence-document">${escapeHtml(evidence)}</pre>`);
}

export function renderDemoPage(template: string): string {
  if (!template.includes('<!-- recorded-case-study -->') || !/<aside class="sidebar"[\s\S]*?<\/aside>/.test(template)) throw new Error('Public demo template slots missing');
  return template.replace('<body>', '<body class="public-preview">')
    .replace(/<aside class="sidebar"[\s\S]*?<\/aside>/, siteHeader('demo'))
    .replace('<!-- recorded-case-study -->', `<section id="case-study" class="study-teaser" aria-labelledby="study-teaser-heading"><div><p class="site-eyebrow">LOOKING FOR RECORDED DATA?</p><h2 id="study-teaser-heading">Explore the failure diagnosis study.</h2><p>Inspect the fixed dataset split, measured results and errors.</p></div><a class="showcase-link" href="/case-study">Read the case study ↗</a></section>`);
}
