const $ = (id) => document.getElementById(id);
const fixture = { robotModel: 'arm-x', gripper: 'parallel-v1', connector: 'connector-demo', material: 'polymer-demo', fixture: 'fixture-7', forceLimitN: 12 };
let config, order, token, busy = false, compatible = false, paymentAttempted = false;
const publicDemo = () => config?.publicDemo === true;
const context = () => ({ ...fixture, gripper: $('arm').value === 'C' ? 'vacuum-v2' : fixture.gripper });
function notice(message, error = false) { $('notice').textContent = message; $('notice').className = error ? 'error' : ''; }
function result(id, text, warning = false) { $(id).hidden = false; $(id).textContent = text; $(id).className = `result${warning ? ' warning' : ''}`; }
async function api(path, body, authenticated = false) {
  const headers = { 'x-experiencebridge-client': 'local-ui' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authenticated) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
function controls() {
  document.querySelectorAll('button').forEach(button => { button.disabled = busy || !config; });
  $('arm').disabled = busy;
  $('quote').hidden = !compatible || Boolean(order && order.state !== 'rejected' && !(order.state === 'quoted' && !paymentAttempted && Date.parse(order.expiresAt) <= Date.now()));
  $('pay').hidden = !order || order.state !== 'quoted' || paymentAttempted;
  $('pay').disabled = busy || !order || Date.parse(order.expiresAt) <= Date.now();
  $('verify').hidden = !order || (!order.transactionHash && !paymentAttempted) || order.state === 'rejected';
  $('recover').hidden = order?.state !== 'confirmed';
  $('rebroadcast').hidden = order?.state !== 'pending';
  $('rebroadcast-help').hidden = order?.state !== 'pending';
  if (publicDemo()) {
    for (const id of ['quote', 'pay', 'verify', 'rebroadcast', 'rebroadcast-help', 'copy']) $(id).hidden = true;
    $('recover').hidden = !compatible;
    return;
  }
  if (order?.state !== 'confirmed') { $('advisory').hidden = true; $('recovery-result').hidden = true; }
}
function previewScene(state, message, force) {
  if (!publicDemo()) return;
  const arm = $('arm').value === 'C' ? 'C' : 'B';
  $('demo-scene').setAttribute('data-state', state);
  $('demo-scene').setAttribute('data-arm', arm);
  $('scene-machine').textContent = arm === 'C' ? 'Arm C · vacuum gripper' : 'Arm B · parallel gripper';
  $('scene-status').textContent = message;
  $('scene-force').textContent = force;
}
function previewStep(id, focus = true) {
  if (!publicDemo()) return;
  const panels = ['experience', 'compatibility', 'payment-panel'];
  const progress = ['progress-baseline', 'progress-compatibility', 'progress-recovery'];
  panels.forEach((panel, index) => {
    $(panel).hidden = panel !== id;
    if (panel === id) $(progress[index]).setAttribute('aria-current', 'step');
    else $(progress[index]).removeAttribute('aria-current');
  });
  if (focus) {
    const heading = $(id).querySelector('h2');
    heading.tabIndex = -1; heading.focus({ preventScroll: true });
    $(id).scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
}
$('restart-demo').onclick = () => {
  if (!publicDemo() || busy) return;
  compatible = false; $('arm').value = 'B';
  for (const id of ['published', 'baseline-result', 'match-result', 'advisory', 'recovery-result', 'restart-demo', 'outcome-strip']) $(id).hidden = true;
  $('baseline-outcome').textContent = 'Not run'; $('memory-outcome').textContent = 'Not run';
  previewScene('ready', 'Baseline not measured.', '12 N simulated baseline');
  previewStep('experience'); controls(); notice('Run the baseline to begin.');
};
$('change-machine').onclick = () => {
  if (!publicDemo() || busy) return;
  compatible = false; $('match-result').hidden = true; $('recovery-result').hidden = true;
  $('memory-outcome').textContent = 'Not run';
  previewScene('checking', 'Choose receiving hardware.', 'Recovery not measured');
  previewStep('compatibility'); controls(); notice('Choose Arm B or try Arm C to see an incompatible match.');
};
async function action(work) {
  if (busy) return;
  busy = true; controls(); notice('Working…');
  try { await work(); }
  catch (error) { previewScene('error', 'No result from this attempt. Retry this step.', 'Not measured'); notice(error.message || 'Request failed. Check the server and network.', true); }
  finally { busy = false; controls(); }
}
function save() {
  try { sessionStorage.setItem('experiencebridge-order', JSON.stringify({ id: order.id, token, paymentAttempted })); }
  catch { notice('Browser storage is unavailable. Keep this tab open to retain access to this order.', true); }
}
function renderOrder() {
  $('payment-empty').hidden = true; $('payment').hidden = false;
  $('order-state').textContent = order.state === 'quoted' && Date.parse(order.expiresAt) <= Date.now() ? 'Quote expired' : order.state;
  $('expiry').textContent = `Quote expires ${new Date(order.expiresAt).toLocaleTimeString()}`;
  $('order-buyer').textContent = order.buyerAddress; $('order-seller').textContent = order.sellerAddress;
  $('amount').textContent = `${order.price} ${order.currency} test tokens`;
  $('pay').textContent = `Pay ${order.price} ${order.currency} test tokens`;
  $('order-reason').textContent = order.reason;
  $('transaction').replaceChildren();
  if (order.transactionHash) {
    if (config.mode !== 'local' && order.explorerUrl && /^https:\/\//.test(order.explorerUrl)) {
      const link = document.createElement('a'); link.href = order.explorerUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `View transaction: ${order.transactionHash} ↗`; $('transaction').append(link);
    } else { $('transaction').textContent = `Transaction: ${order.transactionHash}`; }
  }
  save(); controls();
}
async function balances() {
  const data = await api('/api/network');
  $('buyer-balance').textContent = `${data.buyerBalance} ${data.currency}`;
  $('seller-balance').textContent = `${data.sellerBalance} ${data.currency}`;
}
async function unlock() {
  $('advisory').hidden = true; $('recovery-result').hidden = true;
  const data = await api(`/api/orders/${order.id}/advisory`, undefined, true);
  result('advisory', `Advisory unlocked · ${data.evidence?.level || 'simulation-tested'}\n${data.advisory.procedure} · ${data.advisory.forceN} N\nFor this constructed fixture only.`);
}
async function verify() {
  $('advisory').hidden = true; $('recovery-result').hidden = true;
  ({ order } = await api(`/api/orders/${order.id}/verify`, {}, true));
  if (order.state === 'quoted' && !order.transactionHash) paymentAttempted = false;
  renderOrder();
  if (order.state === 'confirmed') { await unlock(); await balances(); notice('Payment confirmed. The recovery is ready to try.'); }
  else notice(order.reason || 'Waiting for network finality.', order.state === 'rejected');
}
$('refresh').onclick = () => action(async () => { await balances(); notice('Balances refreshed.'); });
$('copy').onclick = () => action(async () => { await navigator.clipboard.writeText(config.buyerAddress); notice('Buyer address copied. Use it as the faucet recipient.'); });
$('publish').onclick = () => action(async () => {
  previewScene('measuring', 'Measuring the baseline…', '12 N simulated baseline');
  const data = await api('/api/demo/publish', {});
  result('published', `${publicDemo() ? 'Loaded' : 'Published'} ${data.id}\nEvidence: ${data.evidence?.level || 'simulation-tested'}\nContributor: ${data.contributor?.machineId || 'Arm A'} (synthetic identity)`);
  if (publicDemo()) {
    const baseline = await api('/simulation/run', { context: fixture });
    previewScene(baseline.outcome === 'success' ? 'success' : 'failure', `Baseline result: ${baseline.outcome}.`, `${baseline.forceN} N simulated force`);
    $('baseline-outcome').textContent = `${baseline.outcome} · ${baseline.forceN} N`;
    $('memory-outcome').textContent = 'Not run'; $('restart-demo').hidden = false; $('outcome-strip').hidden = false;
    compatible = false; previewStep('compatibility');
    notice('Baseline measured. Choose a receiving machine and check its compatibility.');
    return;
  }
  notice('Sample ready. Run the baseline or check compatibility.');
});
$('baseline').onclick = () => action(async () => {
  const data = await api('/simulation/run', { context: fixture });
  result('baseline-result', `Arm B baseline: ${data.outcome}\nForce: ${data.forceN} N · seed ${data.seed} · ${data.fixture}`, data.outcome !== 'success'); notice('Baseline measured in the constructed fixture.');
});
$('arm').onchange = () => { previewScene('checking', 'Hardware not checked.', 'Recovery not measured'); if (publicDemo()) $('memory-outcome').textContent = 'Not run'; compatible = false; $('advisory').hidden = true; $('recovery-result').hidden = true; $('match-result').hidden = true; controls(); };
$('match').onclick = () => action(async () => {
  previewScene('checking', 'Checking hardware compatibility…', 'Recovery not measured');
  compatible = false;
  $('match-result').hidden = true; $('advisory').hidden = true; $('recovery-result').hidden = true;
  controls();
  const data = await api('/experiences/query', { task: 'connector_insertion', context: context(), use: 'synthetic-demo' });
  const match = data.results.find(item => item.id === 'exp-001'); compatible = match?.status === 'compatible';
  result('match-result', match ? `${match.status}\n${match.reasons.join('\n')}` : 'No experience found. Publish the sample first.', !compatible);
  previewScene(compatible ? 'matched' : 'blocked', compatible ? 'Hardware matched. Recovery not measured.' : 'No compatible lesson for this hardware.', compatible ? '8 N simulated advisory' : 'No advisory');
  if (publicDemo() && compatible) previewStep('payment-panel');
  notice(compatible ? (publicDemo() ? 'Compatible. Run the recovery preview.' : 'Compatible. You can request a payment quote.') : publicDemo() ? 'No compatible lesson for this machine. Try Arm B for a matching recovery.' : 'No payment quote is available for this selection.');
});
$('quote').onclick = () => action(async () => {
  if (publicDemo()) return;
  const data = await api('/api/orders', { experienceId: 'exp-001', context: context(), idempotencyKey: crypto.randomUUID() });
  order = data.order; token = data.token; paymentAttempted = false;
  $('advisory').hidden = true; $('recovery-result').hidden = true; renderOrder(); notice('Review the sender, recipient and amount before paying.');
});
$('pay').onclick = () => action(async () => {
  if (publicDemo()) return;
  paymentAttempted = true; save(); controls();
  try { ({ order } = await api(`/api/orders/${order.id}/pay`, {}, true)); renderOrder(); }
  catch (error) {
    try {
      ({ order } = await api(`/api/orders/${order.id}`, undefined, true));
      if (order.state === 'quoted' && !order.transactionHash) paymentAttempted = false;
      renderOrder();
    } catch { /* Keep payment disabled until the server confirms the order state. */ }
    notice(`${error.message} ${paymentAttempted ? 'Use Check payment to resolve the existing attempt.' : 'No transaction was prepared. Resolve the error, then retry payment on this order.'} Payment will not be sent again automatically.`, true);
    return;
  }
  notice('Transaction submitted. Waiting for confirmed finality…');
  const until = Date.now() + 60000;
  do { await new Promise(resolve => setTimeout(resolve, 2000)); await verify(); } while (order.state === 'pending' && Date.now() < until);
  if (order.state === 'pending') notice('Still pending. Use Check payment to check again. Do not send another payment.');
});
$('verify').onclick = () => action(verify);
$('rebroadcast').onclick = () => action(async () => {
  ({ order } = await api(`/api/orders/${order.id}/pay`, {}, true));
  renderOrder();
  await verify();
});
$('recover').onclick = () => action(async () => {
  $('advisory').hidden = true; $('recovery-result').hidden = true;
  if (publicDemo()) { $('memory-outcome').textContent = 'Not run'; previewScene('measuring', 'Measuring the recovery…', '8 N simulated advisory'); }
  const data = publicDemo()
    ? await api('/api/demo/recovery', { context: context() })
    : await api(`/api/orders/${order.id}/run`, {}, true);
  if (publicDemo()) {
    $('memory-outcome').textContent = `${data.outcome} · ${data.forceN} N`;
    previewScene(data.outcome === 'success' ? 'success' : 'failure', `Recovery result: ${data.outcome}.`, `${data.forceN} N simulated force`);
  }
  result('recovery-result', `${publicDemo() ? 'Arm B recovery preview' : 'Arm B with memory'}: ${data.outcome}\nForce: ${data.forceN} N · seed ${data.seed} · ${data.fixture}`, data.outcome !== 'success'); notice('Recovery measured. Compare this result with the baseline above.');
});
await action(async () => {
  config = await api('/api/config');
  $('network-badge').textContent = config.networkName || (config.mode === 'agung' ? 'Agung testnet · peaq' : config.mode === 'solana-devnet' ? 'Solana devnet' : 'Local EVM · not peaq');
  $('max-fee').textContent = `Paid by the buyer. Capped at ${config.maxFee ?? '0.01'} ${config.currency} test tokens.`;
  $('network-help').textContent = publicDemo() ? 'This public preview has no signing wallet. It runs the synthetic compatibility and recovery example without payment.' : config.mode === 'local' ? 'This local EVM uses pre-funded test wallets. Transfers here are local and do not prove a peaq testnet integration.' : `Fund the buyer with ${config.currency} test tokens, then refresh balances. Keep enough tokens for the price plus network fees.`;
  $('buyer').textContent = config.buyerAddress; $('seller').textContent = config.sellerAddress;
  if (!publicDemo() && config.mode !== 'local' && config.faucetUrl && /^https:\/\//.test(config.faucetUrl)) { $('faucet').href = config.faucetUrl; $('faucet').hidden = false; }
  if (publicDemo()) {
    document.body.classList.add('demo-ready');
    previewStep('experience', false);
    previewScene('ready', 'Baseline not measured.', '12 N simulated baseline');
    $('page-title').textContent = 'Try a recovery with shared memory.';
    $('experience-heading').textContent = 'Run the baseline';
    $('compatibility-heading').textContent = 'Check the receiving machine';
    $('publish').textContent = 'Run baseline';
    $('sample-help').textContent = 'Arm B inserts at 12 N. Record the outcome before using shared memory.';
    $('compatibility-help').textContent = 'Choose Arm B for a recovery, or Arm C to test rejection.';
    $('hardware-help').textContent = 'The receiving hardware must match the recorded lesson.';
    $('baseline').hidden = true;
    $('recover').textContent = 'Run recovery preview';
    $('settlement-heading').textContent = 'Test the shared recovery';
    $('settlement-help').textContent = 'The machine is compatible. Try the lower-force advisory in the same constructed fixture.';
    $('payment-empty-title').textContent = 'Simulation preview. No payment sent.';
    $('payment-empty-help').textContent = 'Compare the result with the baseline above. No payment is sent.';
    $('wallet-custody').textContent = 'No signing wallet is connected to this public preview.';
    $('workspace-description').textContent = 'Measure a failure. Find a compatible lesson. Compare the recovery.';
    $('guide-access-title').textContent = 'Preview the recovery';
    $('guide-access-help').textContent = 'A compatible machine can try the synthetic advisory without payment in this preview.';
    $('evidence-link').hidden = false;
    $('case-study-link').hidden = false;
    notice('Run the baseline to begin.');
    return;
  }
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem('experiencebridge-order') || 'null'); } catch { /* A fresh session can proceed without a saved order. */ }
  if (saved?.id && saved?.token) {
    token = saved.token; paymentAttempted = Boolean(saved.paymentAttempted);
    try { ({ order } = await api(`/api/orders/${encodeURIComponent(saved.id)}`, undefined, true)); renderOrder(); if (order.transactionHash || paymentAttempted) await verify(); }
    catch (error) { notice(`Saved order could not be restored: ${error.message}`, true); await balances(); return; }
  }
  await balances(); notice(order ? 'Saved order restored. No new payment was sent.' : 'Workspace ready. Start by publishing Arm A’s sample.');
});

async function peaqosReadiness() {
  try {
    const snapshot = await api('/api/peaqos');
    if (!snapshot || typeof snapshot.status !== 'string') throw new Error('Invalid readiness snapshot.');
    $('peaqos-status').textContent = snapshot.status === 'blocked' ? (snapshot.error === 'INSUFFICIENT_TEST_TOKENS' ? 'peaqOS: waiting for test tokens' : 'peaqOS: activation blocked') : 'peaqOS: activation not verified by this preview';
    const observed = typeof snapshot.observedAt === 'string' && Number.isFinite(Date.parse(snapshot.observedAt)) ? snapshot.observedAt : 'date unavailable';
    let bond = 'Bond unavailable.';
    if (typeof snapshot.preview?.bondAmount === 'string' && /^[0-9]{1,78}$/.test(snapshot.preview.bondAmount)) {
      const wei = BigInt(snapshot.preview.bondAmount);
      const fraction = (wei % 1000000000000000000n).toString().padStart(18, '0').replace(/0+$/, '');
      bond = `Bond: ${wei / 1000000000000000000n}${fraction ? '.' + fraction : ''} AGUNG.`;
    }
    const reason = snapshot.error === 'INSUFFICIENT_TEST_TOKENS' ? 'The recorded check found insufficient AGUNG for activation.' : 'Activation has not been verified.';
    $('peaqos-detail').textContent = `${reason} ${bond} Recorded check: ${observed}. This is a saved snapshot, not a live balance or activation check.`;
    const registration = snapshot.activationStateError === 'MACHINE_NOT_FOUND' ? 'The machine was not registered in the recorded check.' : 'Machine registration is not verified.';
    $('peaqos-machine').textContent = `${registration}${typeof snapshot.machineId === 'string' ? ` Computed ID: ${snapshot.machineId}. An ID alone does not prove registration.` : ''}`;
  } catch {
    $('peaqos-status').textContent = 'peaqOS: readiness unavailable';
    $('peaqos-detail').textContent = 'The recorded SDK preview could not be loaded. The simulator remains available. Machine activation is not verified.';
    $('peaqos-machine').textContent = '';
  }
}
await peaqosReadiness();

setInterval(() => { if (!busy && order?.state === 'quoted') controls(); }, 1000);
