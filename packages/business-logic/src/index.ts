export const MARKETPLACE_COMMISSION_PERCENT = 5;
export const FREE_DELIVERY_THRESHOLD_GMD = 2_000;
export const STANDARD_DELIVERY_FEE_GMD = 200;

export function calculateCommission(grossAmount: number, percentage = MARKETPLACE_COMMISSION_PERCENT) {
  const commission = Math.round(grossAmount * percentage / 100);
  return { grossAmount, percentage, commission, sellerAmount: grossAmount - commission };
}

export function calculateDeliveryFee(
  subtotal: number,
  fulfillmentType: "delivery" | "pickup",
  everyItemHasFreeShipping = false,
): number {
  if (fulfillmentType === "pickup" || everyItemHasFreeShipping || subtotal >= FREE_DELIVERY_THRESHOLD_GMD) {
    return 0;
  }
  return STANDARD_DELIVERY_FEE_GMD;
}

export function calculateOrderTotal(subtotal: number, shipping: number, discount = 0): number {
  return Math.max(0, subtotal + shipping - discount);
}

export function formatDalasi(amount: number): string { return `D ${amount.toLocaleString("en-GM")}`; }
