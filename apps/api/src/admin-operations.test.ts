import assert from "node:assert/strict";
import test from "node:test";
import { disputeResolutionIsComplete, isSafeEvidenceUrl, reconciliationIssues, safeCsvValue } from "./admin-operations";

test("reconciliation identifies missing orders, amount differences and refund mismatches", () => {
  assert.deepEqual(reconciliationIssues({ paymentStatus: "succeeded", paymentAmount: 100 }), ["missing_order"]);
  assert.deepEqual(reconciliationIssues({ paymentStatus: "succeeded", paymentAmount: 100, orderTotal: 90, orderStatus: "pending" }), ["amount_mismatch", "order_not_paid"]);
  assert.deepEqual(reconciliationIssues({ paymentStatus: "refunded", paymentAmount: 100, orderTotal: 100, orderStatus: "refunded", refundStatus: "pending" }), ["refund_mismatch"]);
});
test("resolved disputes require a meaningful typed resolution", () => {
  assert.equal(disputeResolutionIsComplete("investigating"), true);
  assert.equal(disputeResolutionIsComplete("resolved", "too short", "full_refund"), false);
  assert.equal(disputeResolutionIsComplete("resolved", "A complete resolution", "full_refund"), true);
});
test("CSV values neutralize spreadsheet formulas and quote delimiters", () => {
  assert.equal(safeCsvValue("=HYPERLINK(\"bad\")"), '"\'=HYPERLINK(""bad"")"');
  assert.equal(safeCsvValue("hello, world"), '"hello, world"');
});
test("evidence links accept HTTPS and managed uploads only", () => {
  assert.equal(isSafeEvidenceUrl("/uploads/evidence.png"), true);
  assert.equal(isSafeEvidenceUrl("https://files.example.com/evidence.png"), true);
  assert.equal(isSafeEvidenceUrl("javascript:alert(1)"), false);
  assert.equal(isSafeEvidenceUrl("http://unsafe.example.com/file"), false);
});
