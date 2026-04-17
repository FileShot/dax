/**
 * Pill — small badge/tag with consistent typographic scale.
 * Variants: neutral | accent | success | warning | error | info | ghost
 * Sizes: xs (9px) | sm (10px) | md (11px)
 */
export default function Pill({
  children,
  variant = 'neutral',
  size = 'sm',
  uppercase = true,
  icon: Icon,
  dot = false,
  className = '',
  ...rest
}) {
  const variantMap = {
    neutral: 'bg-white/[0.06] text-dax-text-dim border border-white/[0.08]',
    accent:  'bg-dax-accent/[0.12] text-dax-accent border border-dax-accent/25',
    success: 'bg-dax-success/[0.12] text-dax-success border border-dax-success/25',
    warning: 'bg-dax-warning/[0.12] text-dax-warning border border-dax-warning/25',
    error:   'bg-dax-error/[0.12] text-dax-error border border-dax-error/25',
    info:    'bg-dax-info/[0.12] text-dax-info border border-dax-info/25',
    ghost:   'bg-transparent text-dax-text-dim border border-white/[0.06]',
  };
  const sizeMap = {
    xs: 'text-[9px] px-1.5 py-0.5 gap-1',
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-[11px] px-2.5 py-1 gap-1.5',
  };
  const tx = uppercase ? 'uppercase tracking-[0.04em] font-semibold' : 'font-medium';
  return (
    <span
      className={`inline-flex items-center rounded-full whitespace-nowrap leading-none ${variantMap[variant] || variantMap.neutral} ${sizeMap[size] || sizeMap.sm} ${tx} ${className}`}
      {...rest}
    >
      {dot && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-90" />}
      {Icon && <Icon size={size === 'md' ? 11 : 9} />}
      {children}
    </span>
  );
}
