import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Reusable text input. All colours come from theme tokens (see `src/index.css`).
 */
const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  type = 'text',
  className = '',
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-app-text-muted mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        className={`
          w-full px-4 py-2.5
          bg-app-surface-muted border border-app-border rounded-lg
          text-app-text placeholder-app-text-subtle
          focus:outline-none focus:ring-2 focus:ring-app-focus focus:border-transparent
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-app-danger focus:ring-app-danger/40' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-app-danger">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
