import { useMemo } from 'react';
import { useEnterprise } from '../contexts/EnterpriseContext';

export interface BrandTokens {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryContrast: string;
  secondary: string | null;
  logo: string | null;
  title: string;
}

const DEFAULT: BrandTokens = {
  primary: '#4E9594',
  primaryDark: '#195460',
  primarySoft: '#EBFEFA',
  primaryContrast: '#ffffff',
  secondary: null,
  logo: '/cobreai-logo.png',
  title: 'Cobreai Hub',
};

// ─── Helpers de cor (sem libs externas) ──────────────────────────────────

function clampHex(hex: string): string | null {
  if (!hex) return null;
  const h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    const [r, g, b] = h.split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (h.length === 6 && /^[0-9a-f]{6}$/i.test(h)) {
    return `#${h.toLowerCase()}`;
  }
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const toHex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Mistura `hex` com branco (amount=1 → branco). */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

/** Mistura `hex` com preto (amount=1 → preto). */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Texto contrastante (branco ou preto) por luminância relativa (WCAG). */
function contrast(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#0f172a' : '#ffffff';
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useBrand(): BrandTokens {
  const { current } = useEnterprise();

  return useMemo(() => {
    const safePrimary = clampHex(current?.primary_color ?? '');
    if (!safePrimary) {
      return {
        ...DEFAULT,
        logo: current?.logo_url ?? null,
        title: current?.title || DEFAULT.title,
      };
    }

    return {
      primary: safePrimary,
      primaryDark: darken(safePrimary, 0.42),
      primarySoft: lighten(safePrimary, 0.88),
      primaryContrast: contrast(safePrimary),
      secondary: clampHex(current?.secondary_color ?? '') ?? null,
      logo: current?.logo_url ?? null,
      title: current?.title || DEFAULT.title,
    };
  }, [
    current?.primary_color,
    current?.secondary_color,
    current?.logo_url,
    current?.title,
  ]);
}
