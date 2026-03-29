// ─────────────────────────────────────────────────────────────────
//  toothPaths.ts — Maps FDI tooth numbers to PNG image assets
//  Images are in /public/teeth/
// ─────────────────────────────────────────────────────────────────

// Surface polygons for the oclusal view modal (viewBox 0 0 100 100)
export const SURFACE_PATHS = {
  vestibular: 'M 10,5 L 90,5 L 75,25 L 25,25 Z',
  lingual:    'M 10,95 L 90,95 L 75,75 L 25,75 Z',
  mesial:     'M 5,10 L 25,25 L 25,75 L 5,90 Z',
  distal:     'M 95,10 L 75,25 L 75,75 L 95,90 Z',
  oclusal:    'M 25,25 L 75,25 L 75,75 L 25,75 Z',
};

/**
 * Get the image path for a given FDI tooth number
 */
export function getToothImageSrc(numero: string): string {
  const num = parseInt(numero, 10);
  const position = num % 10;

  let type: string;
  if (position >= 6) type = 'molar';
  else if (position >= 4) type = 'premolar';
  else if (position === 3) type = 'canine';
  else type = 'incisor';

  // Always use upper tooth images (better quality); lower teeth are
  // flipped vertically via CSS in the rendering code.
  return `/teeth/upper_${type}.png`;
}

/**
 * Get the occlusal (top-down) image path for a given FDI tooth number
 */
export function getOcclusalImageSrc(numero: string): string {
  const position = parseInt(numero, 10) % 10;

  let type: string;
  if (position >= 6) type = 'molar';
  else if (position >= 4) type = 'premolar';
  else if (position === 3) type = 'canine';
  else type = 'incisor';

  return `/teeth/occlusal_${type}.png`;
}

/**
 * Whether a tooth is in the upper jaw
 */
export function isUpperTooth(numero: string): boolean {
  return Math.floor(parseInt(numero, 10) / 10) <= 2;
}

/**
 * Whether the tooth image should be mirrored (right-side teeth: Q1, Q4)
 */
export function shouldMirrorTooth(numero: string): boolean {
  const quadrant = Math.floor(parseInt(numero, 10) / 10);
  return quadrant === 1 || quadrant === 4;
}

/**
 * Whether the tooth PNG is drawn upside-down relative to molar/premolar.
 * Canine and incisor PNGs have root-up / crown-down, so they need scaleY(-1).
 */
export function isToothPNGFlipped(numero: string): boolean {
  const position = parseInt(numero, 10) % 10;
  return position >= 3 && position <= 5; // canine (3) & premolars (4,5) are drawn crown-up/root-down
}
