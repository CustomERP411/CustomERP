import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Reusable Input Component
 * Styled with Tailwind CSS
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        className={`
          w-full px-4 py-2.5 
          bg-gray-50 border border-gray-300 rounded-lg
          text-gray-900 placeholder-gray-500
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;

