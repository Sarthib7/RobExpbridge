const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

// Render only inline citations. Other Markdown, including diagrams, stays readable source text.
function evidenceCitations(evidence: string): string {
  return escapeHtml(evidence).replace(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+|(?:data|docs)\/[^\s)]+)\)/g, (_, label: string, target: string) => {
    const href = target.startsWith('https://') ? target : `https://github.com/Sarthib7/RobExpbridge/blob/main/${target}`;
    return `<a href="${href}">${label}</a>`;
  });
}

export function siteHeader(current: 'home' | 'demo' | 'showcases' | 'study' | 'evidence'): string {
  const active = (page: string) => current === page ? ' aria-current="page"' : '';
  return `<header class="site-header">
    <div class="site-header-inner">
      <div class="site-identity"><a class="site-product" href="/" aria-label="exbridge home">exbridge<span>Machine experience exchange</span></a><a class="site-maker" href="https://noesora.xyz" aria-label="Noesora home"><svg viewBox="0 0 96 96" aria-hidden="true" focusable="false"><path d="M30 16H16V80H30M66 16H80V80H66M30 70L66 26" fill="none" stroke="currentColor" stroke-width="6"/><rect x="45" y="45" width="6" height="6" fill="currentColor"/></svg><span>by Noesora ↗</span></a></div>
      <nav class="site-nav" aria-label="Main navigation">
        <a href="/#about"${active('home')}>About</a>
        <a href="/showcases"${active('showcases')}>Showcases</a>
        <a id="case-study-link" href="/case-study"${active('study')}>Case study</a>
        <a id="evidence-link" href="/evidence"${active('evidence')}>Evidence</a>
        <a class="site-demo-link" href="/demo#demo"${active('demo')}>Try demo <span aria-hidden="true">↗</span></a>
      </nav>
    </div>
  </header>`;
}

const footer = `<footer class="footer-note"><span>exbridge / A Noesora product</span><a href="https://github.com/Sarthib7/RobExpbridge">Source code ↗</a></footer>`;

function page(title: string, description: string, current: 'home' | 'showcases' | 'study' | 'evidence', content: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#080b0d"><meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(title)} | exbridge</title><link rel="stylesheet" href="/styles.css"></head><body class="public-preview showcase-page"><a class="skip-link" href="#main">Skip to content</a>${siteHeader(current)}<main id="main" tabindex="-1">${content}${footer}</main></body></html>`;
}

export function renderShowcases(): string {
  return page('Showcases', 'Explore the constructed recovery demo and the recorded robot-failure diagnosis study.', 'showcases', `
    <div class="showcase-intro"><p class="site-eyebrow">EXPLORE EXBRIDGE</p><h1>Two ways to test shared memory.</h1><p class="lede">Try a recovery in a constructed fixture. Then inspect a diagnosis test with recorded sensor data.</p></div>
    <div class="showcase-grid">
      <article class="showcase-card"><div class="showcase-art recovery-art" aria-hidden="true"><svg viewBox="0 0 440 220"><path class="art-grid" d="M20 180H420M70 30V190M170 30V190M270 30V190M370 30V190"/><path class="art-arm" d="M95 175V110l65-55 65 48"/><circle cx="95" cy="110" r="9"/><circle cx="160" cy="55" r="9"/><circle cx="225" cy="103" r="8"/><path class="art-gripper" d="M225 112v13m-10 0h20m-20 0v15m20-15v15"/><path class="art-fixture" d="M195 180v-20h60v20"/><path class="art-memory" d="M284 60q65 0 65 66"/><path class="art-memory" d="m340 117 9 10 9-10"/><text x="279" y="48">SHARED LESSON</text><text x="292" y="158">CHECK → TRY</text></svg></div><div class="showcase-copy"><p class="site-eyebrow">01 / CONSTRUCTED SIMULATION</p><h2>A lesson at the fixture</h2><p>Measure a slip, check the receiving gripper, and try the lower-force advisory in the same fixture.</p><p class="showcase-limit">Synthetic outcomes. No physical robot or payment.</p><a class="showcase-link" href="/demo#demo">Run the recovery demo <span aria-hidden="true">↗</span></a></div></article>
      <article class="showcase-card"><div class="showcase-art study-art" aria-hidden="true"><svg viewBox="0 0 440 220"><rect x="35" y="45" width="150" height="125" rx="8"/><path class="art-records" d="M55 70h110M55 90h110M55 110h110M55 130h110M55 150h70"/><path class="art-memory" d="M195 105h55m-10-9 10 9-10 9"/><rect x="265" y="65" width="140" height="85" rx="8"/><text x="54" y="198">RECORDED TRACES</text><text x="284" y="104">SIMILAR</text><text x="284" y="125">FAILURE?</text></svg></div><div class="showcase-copy"><p class="site-eyebrow">02 / RECORDED DATA</p><h2>Find a similar failure</h2><p>Compare a held-out sensor trace with reference recordings from Kaggle/UCI Robot Execution Failures.</p><p class="showcase-limit">Post-failure diagnosis. Recovery success was not measured.</p><a class="showcase-link" href="/case-study">Read the case study <span aria-hidden="true">↗</span></a></div></article>
    </div><aside class="showcase-boundary"><h2>Read each result with its limits.</h2><p>The demo tests a constructed recovery path. The study tests diagnosis on one fixed dataset split. Neither establishes physical robot safety.</p><a href="/evidence">Inspect the run evidence ↗</a></aside>`);
}

export function renderStudyPage(study: string): string {
  return page('Recorded failure case study', 'Results, errors and method for the Kaggle/UCI robot-failure diagnosis test.', 'study', `<a class="back-link" href="/showcases">← All showcases</a><div class="showcase-intro"><p class="site-eyebrow">CASE STUDY / KAGGLE + UCI</p><h1>Find a similar recorded failure.</h1><p class="lede">An offline diagnosis test with force and torque recordings. Read the results alongside the errors and source data.</p></div>${study}`);
}

export function renderEvidencePage(evidence: string): string {
  return page('Run evidence', 'Recorded run evidence and integration limits for exbridge.', 'evidence', `<a class="back-link" href="/showcases">← All showcases</a><div class="showcase-intro"><p class="site-eyebrow">RECORDED RUNS</p><h1>Inspect the evidence.</h1><p class="lede">This is the repository’s recorded evidence document. Dates and integration checks describe those runs, not a live network check.</p><a class="showcase-link" href="/evidence.md">Open raw Markdown ↗</a></div><pre class="evidence-document">${evidenceCitations(evidence)}</pre>`);
}

export function renderDemoPage(template: string): string {
  if (!template.includes('<!-- recorded-case-study -->') || !/<aside class="sidebar"[\s\S]*?<\/aside>/.test(template)) throw new Error('Public demo template slots missing');
  return template.replace('<body>', '<body class="public-preview">')
    .replace(/<aside class="sidebar"[\s\S]*?<\/aside>/, siteHeader('demo'))
    .replace('<!-- recorded-case-study -->', `<section id="case-study" class="study-teaser" aria-labelledby="study-teaser-heading"><div><p class="site-eyebrow">LOOKING FOR RECORDED DATA?</p><h2 id="study-teaser-heading">Explore the failure diagnosis study.</h2><p>Inspect the fixed dataset split, measured results and errors.</p></div><a class="showcase-link" href="/case-study">Read the case study ↗</a></section>`);
}


export function renderLandingPage(armFigure: string): string {
  return page('About', 'An evidence-backed exchange for machine experiences. Explore the constructed demo and recorded diagnosis study.', 'home', `
    <section class="landing-hero" aria-labelledby="landing-heading">
      <div class="landing-copy"><p class="site-eyebrow">EXBRIDGE / A NOESORA PRODUCT</p><h1 id="landing-heading">A lesson from one machine.<br><em>A starting point for another.</em></h1><p class="lede">Share a recorded experience. Check whether it fits the receiving machine. Keep the evidence and limits with the advice.</p><div id="demo" class="landing-actions"><a class="button landing-primary" href="/demo#demo">Try the recovery demo ↗</a><a class="showcase-link" href="/showcases">Explore the showcases ↗</a></div><p class="landing-caption">Research MVP. Constructed recovery demo and a separate recorded-data diagnosis study.</p></div>
      <figure id="arm-workcell" class="landing-visual" aria-labelledby="landing-diagram-caption">
        <div class="arm-card"><div class="arm-card-heading"><span>FIG. 01 / CONCEPT</span><span>How a lesson reaches another arm</span></div>
        ${armFigure}
        <div class="arm-card-controls"><div><button id="arm-pause" type="button" hidden>Pause animation</button><button id="arm-next" type="button" hidden>Next step</button></div><div id="arm-story" role="status" aria-live="off"><h3 id="arm-readout">01 / Arm A records a lesson</h3><p id="arm-detail">A local attempt becomes a record with task context and evidence.</p></div></div></div>
        <p class="arm-legend"><span>Arm A · record</span><span>Context review</span><span>Arm B · consult</span></p><ol class="arm-stages" aria-label="Illustrated sequence"><li id="arm-stage-0" aria-current="step">Record</li><li id="arm-stage-1">Check fit</li><li id="arm-stage-2">Send advice</li><li id="arm-stage-3">Try locally</li></ol>
        <figcaption id="landing-diagram-caption">Concept animation: the blue card is a lesson record, not a physical object. Arm A records, context is checked, then Arm B receives advice. This is not live telemetry or a measured recovery. No robot commands are sent.</figcaption>
      </figure><script src="/arm-model.js" defer></script><script src="/arm-figure.js" defer></script>
    </section>
    <section id="about" class="landing-about" aria-labelledby="about-heading"><div><p class="site-eyebrow">ABOUT EXBRIDGE</p><h2 id="about-heading">Share the lesson.<br>Keep the context.</h2></div><div><p>exbridge is a prototype for sharing machine experiences with their task, hardware context and evidence. A receiving machine can query a lesson and see why it matches, needs review or must be rejected.</p><p>The current recovery demo uses a constructed connector-insertion fixture. Compatible Arm B receives an advisory. Arm C has a different gripper and is rejected.</p><p class="landing-boundary">Advice stays separate from execution. Existing controllers and operators retain control. The prototype does not establish physical robot safety.</p></div></section>
    <section class="landing-how" aria-labelledby="how-heading"><p class="site-eyebrow">THE IDEA, STEP BY STEP</p><h2 id="how-heading">Context travels with the experience.</h2><ol class="landing-steps"><li><span>01 / CONTRIBUTE</span><h3>Record the lesson</h3><p>Attach task context, provenance, evidence and permitted uses.</p></li><li><span>02 / CHECK</span><h3>Check the fit</h3><p>Reject incompatible hardware and records with insufficient evidence.</p></li><li><span>03 / ADVISE</span><h3>Return an advisory</h3><p>The authorized controller decides whether to act. Retrieval is not permission to execute.</p></li></ol></section>
    <section id="case-study" class="landing-proof" aria-labelledby="proof-heading"><div><p class="site-eyebrow">WHAT YOU CAN INSPECT TODAY</p><h2 id="proof-heading">Explore the work behind the idea.</h2><p>The recovery demo tests a constructed scenario. The Kaggle/UCI study tests similar-failure diagnosis on recorded force and torque traces.</p><p class="landing-boundary">Recorded diagnosis does not measure recovery success. peaqOS activation and hardware-backed privacy remain unverified.</p></div><div class="landing-destinations"><a href="/demo#demo"><span>01 / SYNTHETIC FIXTURE</span><strong>Run the recovery demo ↗</strong></a><a href="/case-study"><span>02 / RECORDED DATA</span><strong>Read the diagnosis study ↗</strong></a><a href="/evidence"><span>03 / RECORDED RUNS</span><strong>Inspect the evidence ↗</strong></a></div></section>`);
}
