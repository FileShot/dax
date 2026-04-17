/**
 * SectionTitle — consistent inline subsection header.
 */
export default function SectionTitle({ children, icon: Icon, action, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={13} className="text-dax-accent" />}
        <h2 className="text-[12px] uppercase tracking-[0.08em] font-semibold text-dax-text-bright/80">
          {children}
        </h2>
      </div>
      {action}
    </div>
  );
}
