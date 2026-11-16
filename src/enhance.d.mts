export interface LanesEnhancementOptions {
  /** Use the JavaScript renderer even when native cyclic Grid Lanes exists. */
  force?: boolean;
}

export interface LanesController {
  /** Schedule one layout after a CSS-only setting change. */
  refresh(): void;
  /** Disconnect observers, cancel pending work and restore helper-owned styles. */
  destroy(): void;
}

/** Enhance horizontal mode; native-capable browsers keep native layout by default. */
export declare function enhanceLanes(
  container: HTMLElement,
  options?: LanesEnhancementOptions,
): LanesController;
