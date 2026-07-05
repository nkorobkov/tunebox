const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  dangerOutline: 'bg-white border border-red-300 text-red-600 hover:bg-red-50',
  ghost: 'text-gray-500 hover:text-gray-700',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5',
};

/**
 * Standard button. Pass `href` to render a link styled as a button.
 * Extra classes (widths, margins) can be appended via `class`.
 */
export function Button({ variant = 'primary', size = 'sm', href, class: cls = '', children, ...props }) {
  const classes = `inline-flex items-center justify-center gap-1 font-medium rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${cls}`;
  if (href) {
    return <a href={href} class={`${classes} no-underline`} {...props}>{children}</a>;
  }
  return <button class={classes} {...props}>{children}</button>;
}
