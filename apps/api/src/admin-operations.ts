export function reconciliationIssues(input: { paymentStatus: string; paymentAmount: number; orderStatus?: string; orderTotal?: number; refundStatus?: string }): string[] {
  const issues: string[] = [];
  if (!input.orderStatus) issues.push("missing_order");
  if (input.orderTotal != null && input.orderTotal !== input.paymentAmount) issues.push("amount_mismatch");
  const paidOrderStates = new Set(["paid", "confirmed", "processing", "preparing", "ready_for_pickup", "searching_rider", "rider_searching", "rider_assigned", "rider_arrived_vendor", "picked_up", "on_the_way", "shipped", "delivered", "completed", "refunded"]);
  if (input.paymentStatus === "succeeded" && input.orderStatus && !paidOrderStates.has(input.orderStatus)) issues.push("order_not_paid");
  if (input.paymentStatus === "refunded" && input.refundStatus !== "succeeded") issues.push("refund_mismatch");
  return issues;
}
export function disputeResolutionIsComplete(status: string, resolution?: string, resolutionType?: string): boolean {
  if (!["resolved", "closed"].includes(status)) return true;
  return !!resolution && resolution.trim().length >= 10 && !!resolutionType;
}
export function safeCsvValue(value: unknown): string {
  let text = value == null ? "" : value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function isSafeEvidenceUrl(value: string): boolean {
  return value.startsWith("/uploads/") || /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/|$)/i.test(value);
}
