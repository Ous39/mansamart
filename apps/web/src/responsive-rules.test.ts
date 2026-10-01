import assert from "node:assert/strict";
import test from "node:test";
import { getAdaptiveDeviceLayout, getResponsiveCardWidth, getResponsiveLayout } from "@mansamart/design-system";

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

test("foldable rules protect vertical hinges and expose two usable panes", () => {
  const layout = getAdaptiveDeviceLayout(1080, 900, {
    orientation: "vertical",
    posture: "book",
    size: 36,
  });
  assert.equal(layout.presentation, "two-pane");
  assert.equal(layout.posture, "book");
  assert.equal(layout.hingeGap, 36);
  assert.equal(layout.paneWidth, (layout.contentWidth - 36) / 2);
});

test("tabletop folds stay single-pane and compact cover screens remain usable", () => {
  assert.equal(getAdaptiveDeviceLayout(884, 720, { orientation: "horizontal", posture: "tabletop" }).presentation, "single-pane");
  assert.equal(getAdaptiveDeviceLayout(320, 748).presentation, "compact");
});

test("representative Apple and Android device profiles never overflow", () => {
  const profiles = [
    { name: "iPhone 18 Pro Max", width: 440, height: 956, expected: "single-pane" },
    { name: "iPhone Duo outer", width: 390, height: 844, expected: "single-pane" },
    { name: "iPhone Duo inner", width: 820, height: 844, expected: "two-pane", fold: { orientation: "vertical" as const, posture: "book" as const, size: 24 } },
    { name: "Galaxy Z Fold cover", width: 344, height: 882, expected: "compact" },
    { name: "Galaxy Z Fold inner", width: 768, height: 884, expected: "two-pane", fold: { orientation: "vertical" as const, posture: "book" as const, size: 24 } },
    { name: "Pixel Fold inner", width: 841, height: 727, expected: "two-pane", fold: { orientation: "vertical" as const, posture: "book" as const, size: 28 } },
    { name: "OnePlus Open inner", width: 800, height: 896, expected: "two-pane", fold: { orientation: "vertical" as const, posture: "book" as const, size: 24 } },
    { name: "Flip cover", width: 320, height: 260, expected: "compact" },
    { name: "Razr unfolded", width: 413, height: 920, expected: "single-pane" },
  ];

  profiles.forEach(profile => {
    const layout = getAdaptiveDeviceLayout(profile.width, profile.height, profile.fold);
    assert.equal(layout.presentation, profile.expected, profile.name);
    assert.ok(layout.contentWidth <= profile.width, `${profile.name} content width`);
    assert.ok(layout.paneWidth >= 0, `${profile.name} pane width`);
  });
});

test("invalid widths degrade safely instead of producing NaN layout values", () => {
  const layout = getResponsiveLayout(Number.NaN);
  assert.equal(layout.width, 280);
  assert.equal(layout.columns, 1);
  assert.equal(getResponsiveCardWidth(Number.NaN), 256);
});
