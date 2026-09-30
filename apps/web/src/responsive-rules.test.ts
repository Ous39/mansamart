import assert from "node:assert/strict";
import test from "node:test";
import { getResponsiveCardWidth, getResponsiveLayout } from "@mansamart/design-system";

test("responsive rules cover compact phones through wide desktops", () => {
  const widths = [280, 390, 768, 1024, 1920];
  const expectedColumns = [1, 2, 3, 4, 4];

  widths.forEach((width, index) => {
    const layout = getResponsiveLayout(width);
    assert.equal(layout.columns, expectedColumns[index]);
    assert.ok(layout.contentWidth <= 1200);
    assert.ok(layout.contentWidth > 0);
    assert.ok(getResponsiveCardWidth(width, layout.columns, 12) >= 150);
  });
});

test("invalid widths degrade safely instead of producing NaN layout values", () => {
  const layout = getResponsiveLayout(Number.NaN);
  assert.equal(layout.width, 280);
  assert.equal(layout.columns, 1);
  assert.equal(getResponsiveCardWidth(Number.NaN), 256);
});
