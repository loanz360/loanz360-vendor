/**
 * LOANZ 360 - Loading Spinner Configuration
 *
 * Change the DEFAULT_SPINNER_VARIANT here to update the loading spinner
 * across the entire application.
 *
 * Available variants:
 * - "pulse"           : Logo pulsing/breathing
 * - "ring"            : Rotating ring around logo (default)
 * - "dots"            : Orbiting dots around logo
 * - "wave"            : Wave effect emanating from logo
 * - "morph"           : Morphing glow effect
 * - "bounce"          : Bouncing logo
 * - "flip"            : 3D flip animation
 * - "radar"           : Radar sweep effect
 * - "particles"       : Floating particles around logo
 * - "gradient-ring"   : Gradient spinning ring
 * - "bounce-balls"    : Logo with bouncing balls below
 * - "letter-bounce"   : Each letter (L-O-A-N-Z-3-6-0) bounces sequentially
 * - "loan-queue"      : People queue animation (fun/creative)
 */

import type { SpinnerVariant } from "@/components/ui/loading-spinner"

// ============================================
// CHANGE THIS TO UPDATE SPINNER EVERYWHERE
// ============================================
export const DEFAULT_SPINNER_VARIANT: SpinnerVariant = "bounce"

// Default logo size for the spinner
export const DEFAULT_LOGO_SIZE = 120

// Default loading text
export const DEFAULT_LOADING_TEXT = "Loading..."

// Default sub-text
export const DEFAULT_LOADING_SUBTEXT = "Please wait"
