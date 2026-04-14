import type { FC, SVGProps } from 'react';
import * as FlagIcons from 'country-flag-icons/react/3x2';

/**
 * Bandeira SVG (country-flag-icons). `code`: ISO 3166-1 alpha-2.
 */
export function CountryFlagSvg({ code, className, title }: { code?: string | null; className?: string; title?: string }) {
  const iso = (code || 'BR').toUpperCase();
  const Flag = (FlagIcons as Record<string, FC<SVGProps<SVGSVGElement>>>)[iso];
  if (!Flag) {
    return (
      <span className={className} title={title ?? iso}>
        🏳️
      </span>
    );
  }
  return <Flag className={className} title={title ?? iso} />;
}
