import type { ImgHTMLAttributes } from 'react';

/** Public URLs under `public/brand/`. */
export const BRAND_LOGO_URL = '/brand/logo.png';
export const BRAND_FAVICON_URL = '/brand/favicon.png';

type BrandMarkProps = {
  /** Horizontal wordmark (dark background) or square puzzle mark. */
  variant: 'wordmark' | 'icon';
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

/**
 * CustomERP brand images from `public/brand/logo.png` and `public/brand/favicon.png`.
 * Size with `className` (e.g. `h-8 w-auto` for wordmark, `h-8 w-8` for icon).
 */
export default function BrandMark({ variant, className = '', alt, ...rest }: BrandMarkProps) {
  return (
    <img
      src={variant === 'wordmark' ? BRAND_LOGO_URL : BRAND_FAVICON_URL}
      alt={alt ?? 'CustomERP'}
      className={className}
      loading="eager"
      decoding="async"
      {...rest}
    />
  );
}
