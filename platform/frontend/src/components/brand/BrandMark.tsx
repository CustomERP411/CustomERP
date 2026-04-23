import type { ImgHTMLAttributes } from 'react';

/** Public URLs under `public/brand/`. */
export const BRAND_LOGO_URL = '/brand/logo.png';
export const BRAND_FAVICON_URL = '/brand/favicon.png';

type BrandMarkProps = {
  /** Horizontal wordmark (dark background) or square puzzle mark. */
  variant: 'wordmark' | 'icon';
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

const baseImgClass =
  'brand-mark block max-w-full bg-transparent [background:transparent] align-middle ' +
  '[-webkit-backface-visibility:hidden] [backface-visibility:hidden] will-change-transform [transform:translate3d(0,0,0)]';

/**
 * CustomERP brand images from `public/brand/logo.png` and `public/brand/favicon.png`.
 * Size with `className` (e.g. `h-8 w-auto` for wordmark, `h-8 w-8` for icon).
 * Explicit transparency + transform layer avoids spurious “white” boxes in some WebKit/Safari cases.
 */
export default function BrandMark({ variant, className = '', alt, style, ...rest }: BrandMarkProps) {
  return (
    <img
      src={variant === 'wordmark' ? BRAND_LOGO_URL : BRAND_FAVICON_URL}
      alt={alt ?? 'CustomERP'}
      className={`${baseImgClass} ${className}`.trim()}
      loading="eager"
      decoding="async"
      style={{ backgroundColor: 'transparent', backgroundImage: 'none', ...style }}
      {...rest}
    />
  );
}
