import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/**
 * Reusable Button.
 * Colours come exclusively from the centralised theme tokens
 * (see `src/index.css` and `tailwind.config.js`). Do not introduce raw
 * `bg-blue-*` / `text-slate-*` here.
 */
export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}: ButtonProps) {
  const base = `
    inline-flex items-center justify-center
    font-semibold rounded-lg
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-app-focus focus:ring-offset-2 focus:ring-offset-app-bg
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-app-accent-blue text-app-text-inverse hover:bg-app-accent-dark-blue',
    secondary: 'bg-app-surface-muted text-app-text border border-app-border hover:bg-app-surface-hover',
    outline: 'border-2 border-app-accent-blue text-app-accent-blue bg-transparent hover:bg-app-accent-blue/10',
    ghost: 'text-app-text-muted hover:bg-app-surface-hover hover:text-app-text',
    danger: 'bg-app-danger text-app-text-inverse hover:opacity-90',
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
