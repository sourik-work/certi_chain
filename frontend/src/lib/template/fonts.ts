/**
 * @file fonts.ts
 * @summary Whitelisted font definitions and dynamic font loader.
 */

export interface FontOption {
  family: string;
  category: 'sans-serif' | 'serif' | 'monospace';
  googleFontName: string;
  weights: number[];
}

export const WHITELISTED_FONTS: FontOption[] = [
  {
    family: 'Plus Jakarta Sans',
    category: 'sans-serif',
    googleFontName: 'Plus+Jakarta+Sans',
    weights: [300, 400, 500, 600, 700, 800],
  },
  {
    family: 'Inter',
    category: 'sans-serif',
    googleFontName: 'Inter',
    weights: [300, 400, 500, 600, 700, 800],
  },
  {
    family: 'Poppins',
    category: 'sans-serif',
    googleFontName: 'Poppins',
    weights: [300, 400, 500, 600, 700, 800],
  },
  {
    family: 'Montserrat',
    category: 'sans-serif',
    googleFontName: 'Montserrat',
    weights: [300, 400, 500, 600, 700, 800],
  },
  {
    family: 'Outfit',
    category: 'sans-serif',
    googleFontName: 'Outfit',
    weights: [300, 400, 500, 600, 700, 800],
  },
  {
    family: 'Playfair Display',
    category: 'serif',
    googleFontName: 'Playfair+Display',
    weights: [400, 500, 600, 700, 800],
  },
  {
    family: 'Merriweather',
    category: 'serif',
    googleFontName: 'Merriweather',
    weights: [300, 400, 700],
  },
  {
    family: 'Cinzel',
    category: 'serif',
    googleFontName: 'Cinzel',
    weights: [400, 500, 600, 700, 800],
  },
  {
    family: 'Cormorant Garamond',
    category: 'serif',
    googleFontName: 'Cormorant+Garamond',
    weights: [400, 500, 600, 700],
  },
  {
    family: 'Great Vibes',
    category: 'serif',
    googleFontName: 'Great+Vibes',
    weights: [400],
  },
  {
    family: 'Roboto',
    category: 'sans-serif',
    googleFontName: 'Roboto',
    weights: [300, 400, 500, 700],
  },
  {
    family: 'Open Sans',
    category: 'sans-serif',
    googleFontName: 'Open+Sans',
    weights: [300, 400, 500, 600, 700, 800],
  },
  {
    family: 'Lato',
    category: 'sans-serif',
    googleFontName: 'Lato',
    weights: [300, 400, 700],
  },
  {
    family: 'Raleway',
    category: 'sans-serif',
    googleFontName: 'Raleway',
    weights: [300, 400, 500, 600, 700, 800],
  },
];

export const DEFAULT_FONT = 'Plus Jakarta Sans';

const loadedFonts = new Set<string>();

/**
 * Dynamically loads Google font stylesheets on-demand when a template uses them.
 */
export function ensureFontLoaded(fontFamily: string): void {
  if (typeof document === 'undefined') return;
  const match = WHITELISTED_FONTS.find(
    (f) => f.family.toLowerCase() === fontFamily.toLowerCase()
  );
  if (!match) return;

  const fontKey = match.family;
  if (loadedFonts.has(fontKey)) return;
  loadedFonts.add(fontKey);

  const linkId = `certichain-font-${match.googleFontName}`;
  if (document.getElementById(linkId)) return;

  const weightsStr = match.weights.join(';');
  const href = `https://fonts.googleapis.com/css2?family=${match.googleFontName}:wght@${weightsStr}&display=swap`;

  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Maps an arbitrary font guess (e.g. from vision analyzer) to the closest whitelisted font.
 */
export function mapToWhitelistedFont(guessedName?: string): string {
  if (!guessedName) return DEFAULT_FONT;
  const clean = guessedName.toLowerCase().replace(/['"-]/g, '').trim();

  for (const font of WHITELISTED_FONTS) {
    const target = font.family.toLowerCase().replace(/['"-]/g, '');
    if (clean.includes(target) || target.includes(clean)) {
      return font.family;
    }
  }

  if (clean.includes('serif') || clean.includes('times') || clean.includes('georgia') || clean.includes('garamond')) {
    return 'Playfair Display';
  }
  if (clean.includes('mono') || clean.includes('code') || clean.includes('courier')) {
    return 'Inter';
  }
  return DEFAULT_FONT;
}
