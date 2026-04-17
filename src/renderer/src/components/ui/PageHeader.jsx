/**
 * PageHeader — standardized page title/subtitle/action-bar layout.
 * Keeps vertical rhythm identical across views.
 */
export default function PageHeader({ title, subtitle, icon: Icon, actions, children, className = '' }) {
  return (
    <header className={`flex items-start justify-between gap-4 mb-6 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-semibold text-dax-text-bright flex items-center gap-2">
          {Icon && <Icon size={22} className="text-dax-accent shrink-0" />}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle && (
          <p className="text-[13px] text-dax-text-dim mt-1">{subtitle}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
