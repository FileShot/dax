/**
 * Card — unified elevated container used across views.
 * Replaces ad-hoc `agent-card` patterns with a consistent component.
 */
import { forwardRef } from 'react';

const Card = forwardRef(function Card(
  { as: Tag = 'div', padding = 'md', interactive = false, selected = false, className = '', children, ...rest },
  ref
) {
  const padMap = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5', xl: 'p-6' };
  const pad = padMap[padding] ?? padMap.md;
  const base =
    'rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm transition-colors ' +
    'hover:bg-white/[0.05]';
  const stateful = interactive ? ' cursor-pointer hover:border-white/[0.14]' : '';
  const isSelected = selected ? ' border-dax-accent/50 bg-dax-accent/[0.04]' : '';
  return (
    <Tag ref={ref} className={`${base}${stateful}${isSelected} ${pad} ${className}`} {...rest}>
      {children}
    </Tag>
  );
});

export default Card;
