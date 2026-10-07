/**
 * Dynamic Font Loader & Google Fonts Registry
 * Loads Google Font stylesheets on demand and caches loaded status to prevent duplicate injections.
 */

import { ALLOWED_FONT_FAMILIES } from './templateAnalysis';

const loadedFonts = new Set<string>();

export interface FontDefinition {
  family: string;
  category: 'sans-serif' | 'serif' | 'cursive';
  googleFontName: string;
  weights: number[];
}

export const GOOGLE_FONT_CATALOG: FontDefinition[] = [
  { family: 'Plus Jakarta Sans', category: 'sans-serif', googleFontName: 'Plus+Jakarta+Sans', weights: [400, 500, 600, 700, 800] },
  { family: 'Inter', category: 'sans-serif', googleFontName: 'Inter', weights: [400, 500, 600, 700, 800] },
  { family: 'Poppins', category: 'sans-serif', googleFontName: 'Poppins', weights: [400, 500, 600, 700, 800] },
  { family: 'Montserrat', category: 'sans-serif', googleFontName: 'Montserrat', weights: [400, 500, 600, 700, 800] },
  { family: 'Outfit', category: 'sans-serif', googleFontName: 'Outfit', weights: [400, 500, 600, 700, 800] },
  { family: 'Playfair Display', category: 'serif', googleFontName: 'Playfair+Display', weights: [400, 600, 700, 800] },
  { family: 'Merriweather', category: 'serif', googleFontName: 'Merriweather', weights: [300, 400, 700] },
  { family: 'Cinzel', category: 'serif', googleFontName: 'Cinzel', weights: [400, 600, 700, 800] },
  { family: 'Cormorant Garamond', category: 'serif', googleFontName: 'Cormorant+Garamond', weights: [400, 500, 600, 700] },
  { family: 'Great Vibes', category: 'cursive', googleFontName: 'Great+Vibes', weights: [400] },
  { family: 'Roboto', category: 'sans-serif', googleFontName: 'Roboto', weights: [400, 500, 700] },
  { family: 'Open Sans', category: 'sans-serif', googleFontName: 'Open+Sans', weights: [400, 600, 700] },
  { family: 'Lato', category: 'sans-serif', googleFontName: 'Lato', weights: [400, 700] },
  { family: 'Raleway', category: 'sans-serif', googleFontName: 'Raleway', weights: [400, 600, 700] },
];

/**
 * Injects Google Fonts link stylesheet if not already loaded.
 */
export function ensureFontLoaded(fontFamily: string): void {
  if (typeof document === 'undefined') return;

  const fontDef = GOOGLE_FONT_CATALOG.find(
    (f) => f.family.toLowerCase() === fontFamily.toLowerCase()
  );

  if (!fontDef) return;
  if (loadedFonts.has(fontDef.family)) return;

  loadedFonts.add(fontDef.family);
  const elementId = `certi-font-${fontDef.googleFontName.replace(/\+/g, '-')}`;

  if (document.getElementById(elementId)) return;

  const weightsParam = fontDef.weights.join(';');
  const href = `https://fonts.googleapis.com/css2?family=${fontDef.googleFontName}:wght@${weightsParam}&display=swap`;

  const link = document.createElement('link');
  link.id = elementId;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Pre-loads all standard catalog fonts.
 */
export function preloadStandardFonts(): void {
  ALLOWED_FONT_FAMILIES.forEach(ensureFontLoaded);
}
