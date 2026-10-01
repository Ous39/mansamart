# Foldable and large-screen support

MansaMart uses one adaptive layout contract across the Customer, Business and
Rider applications. The contract recalculates whenever the available window
changes, including rotation, split screen, unfolding and refolding.

## Layout modes

- `compact`: narrow cover displays below 360 logical pixels.
- `single-pane`: normal phones, large phones and vertically stacked tabletop UI.
- `two-pane`: unfolded book-style devices and other windows at least 700 logical pixels wide.

When the native platform exposes a fold feature through
`MansaMartWindowLayout.currentFoldFeature`, the layout also records its
orientation, posture and obscured hinge size. Vertical hinges divide the usable
content into equal panes. Horizontal tabletop folds stay single-pane so forms,
maps and checkout controls are not split across the fold.

## Covered test profiles

- iPhone 18 Pro Max class
- iPhone Duo outer and inner displays
- Samsung Galaxy Z Fold cover and inner displays
- Samsung Galaxy Z Flip cover displays
- Google Pixel Fold inner display
- OnePlus Open inner display
- Motorola Razr cover and unfolded displays

These profiles are representative logical viewports, not user-agent checks.
Future devices inherit the same rules without requiring a model-name allowlist.

## Release verification

Before store release, test the three apps on the current Apple and Android
simulators plus at least one physical book-style foldable and one flip-style
foldable. Verify authentication, keyboard forms, maps, checkout, camera/QR,
notifications and fold/unfold state preservation.
