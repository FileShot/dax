/**
 * StatBlock — dashboard stat tile used for headline numbers.
 */
import Card from './Card';

export default function StatBlock({ label, value, icon: Icon, accent = '--dax-accent', extra, onClick }) {
  return (
    <Card interactive={!!onClick} padding="md" onClick={onClick}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-dax-text-dim uppercase tracking-[0.08em] font-semibold">
          {label}
        </span>
        {Icon && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `rgb(var(${accent}) / 0.12)` }}
          >
            <Icon size={13} style={{ color: `rgb(var(${accent}))` }} />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-[22px] leading-none font-semibold text-dax-text-bright tabular-nums">
          {value}
        </span>
        {extra}
      </div>
    </Card>
  );
}
