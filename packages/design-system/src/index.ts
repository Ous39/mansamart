export const brand = {
  green: "#0B7A5A",
  greenDark: "#073D35",
  greenLight: "#E9F5F1",
  gold: "#F4B942",
  ink: "#14231F",
  muted: "#66736F",
  surface: "#FFFFFF",
  canvas: "#F4F8F6",
  danger: "#B42318",
} as const;

export const responsiveBreakpoints = {
  compact: 360,
  tablet: 700,
  desktop: 1024,
  wide: 1440,
} as const;

export type ResponsiveLayout = {
  width: number;
  contentWidth: number;
  gutter: number;
  columns: 1 | 2 | 3 | 4;
  isCompact: boolean;
  isTablet: boolean;
  isDesktop: boolean;
};

export type FoldOrientation = "vertical" | "horizontal";
export type FoldPosture = "flat" | "book" | "tabletop";

export type FoldFeature = {
  orientation: FoldOrientation;
  posture?: FoldPosture;
  /** The obscured hinge/fold size reported by the platform, in logical pixels. */
  size?: number;
};

export type AdaptiveDeviceLayout = ResponsiveLayout & {
  orientation: "portrait" | "landscape";
  presentation: "compact" | "single-pane" | "two-pane";
  posture: FoldPosture;
  foldOrientation: FoldOrientation | null;
  hingeGap: number;
  paneWidth: number;
  isFoldable: boolean;
};

/** Pure responsive rules shared by the Expo apps and testable without a DOM. */
export function getResponsiveLayout(viewportWidth: number, maxContentWidth = 1200): ResponsiveLayout {
  const width = Math.max(280, Number.isFinite(viewportWidth) ? viewportWidth : 280);
  const gutter = width < responsiveBreakpoints.compact ? 12 : width < responsiveBreakpoints.tablet ? 16 : 24;
  const columns: ResponsiveLayout["columns"] = width < responsiveBreakpoints.compact
    ? 1
    : width < responsiveBreakpoints.tablet
      ? 2
      : width < responsiveBreakpoints.desktop
        ? 3
        : 4;

  return {
    width,
    contentWidth: Math.min(maxContentWidth, Math.max(0, width - gutter * 2)),
    gutter,
    columns,
    isCompact: width < responsiveBreakpoints.compact,
    isTablet: width >= responsiveBreakpoints.tablet && width < responsiveBreakpoints.desktop,
    isDesktop: width >= responsiveBreakpoints.desktop,
  };
}

export function getResponsiveCardWidth(viewportWidth: number, columns?: number, gap = 12, maxContentWidth = 1200) {
  const layout = getResponsiveLayout(viewportWidth, maxContentWidth);
  const count = Math.max(1, Math.floor(columns ?? layout.columns));
  return Math.max(0, (layout.contentWidth - gap * (count - 1)) / count);
}

/**
 * Creates a stable layout for phones, tablets and foldables. A real platform
 * fold feature always wins; wide screens still receive a useful two-pane
 * fallback so unfolded devices remain usable while native posture data loads.
 */
export function getAdaptiveDeviceLayout(
  viewportWidth: number,
  viewportHeight: number,
  fold?: FoldFeature | null,
  maxContentWidth = 1440,
): AdaptiveDeviceLayout {
  const base = getResponsiveLayout(viewportWidth, maxContentWidth);
  const height = Math.max(280, Number.isFinite(viewportHeight) ? viewportHeight : 280);
  const orientation = base.width > height ? "landscape" : "portrait";
  const hasFold = Boolean(fold);
  const foldOrientation = fold?.orientation ?? null;
  const posture = fold?.posture ?? "flat";
  const hingeGap = hasFold ? Math.max(16, Math.min(72, fold?.size ?? 24)) : 0;
  const canSplit = base.contentWidth >= 700 && (!hasFold || foldOrientation === "vertical");
  const presentation = base.width < 360 ? "compact" : canSplit ? "two-pane" : "single-pane";
  const paneWidth = presentation === "two-pane"
    ? Math.max(0, (base.contentWidth - hingeGap) / 2)
    : base.contentWidth;

  return {
    ...base,
    orientation,
    presentation,
    posture,
    foldOrientation,
    hingeGap,
    paneWidth,
    isFoldable: hasFold,
  };
}
