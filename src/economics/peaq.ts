export async function licenseReceipt(experienceId: string, mode = 'simulation') {
  if (mode !== 'simulation') throw new Error('real peaq settlement is not configured');
  return { status: 'simulated', network: 'none', experienceId, transactionHash: null, explanation: 'Synthetic license receipt. No chain transaction or payment occurred.' };
}
