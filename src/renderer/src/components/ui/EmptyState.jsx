/**
 * EmptyState — unified empty-state panel.
 */
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-10 text-center ${className}`}>
      {Icon && (
        <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <Icon size={22} className="text-dax-text-dim opacity-70" />
        </div>
      )}
      {title && <h3 className="text-sm font-semibold text-dax-text-bright mb-1">{title}</h3>}
      {description && <p className="text-xs text-dax-text-dim max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-4 flex items-center justify-center">{action}</div>}
    </div>
  );
}
