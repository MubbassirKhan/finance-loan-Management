import React, { forwardRef } from 'react';

export const Select = forwardRef(
  (
    {
      label,
      options = [],
      error,
      helperText,
      required = false,
      id,
      name,
      className = '',
      placeholder = 'Select an option',
      ...props
    },
    ref
  ) => {
    const selectId = id || name;

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label htmlFor={selectId} className="block text-sm font-semibold text-slate-800 mb-1.5">
            {label}
            {required && <span className="text-red-600 ml-1 font-bold">*</span>}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          name={name}
          className={`w-full rounded border bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-100 disabled:cursor-not-allowed ${
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-300 focus:border-gov-primary focus:ring-blue-100'
          }`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
        {helperText && !error && <p className="mt-1.5 text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
