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
