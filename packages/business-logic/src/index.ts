export const MARKETPLACE_COMMISSION_PERCENT = 5;
export function calculateCommission(grossAmount: number, percentage = MARKETPLACE_COMMISSION_PERCENT) {
  const commission = Math.round(grossAmount * percentage / 100);
  return { grossAmount, percentage, commission, sellerAmount: grossAmount - commission };
}
export function formatDalasi(amount: number): string { return `D ${amount.toLocaleString("en-GM")}`; }
