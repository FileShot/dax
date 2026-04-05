import { Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  const minimize = () => window.dax?.window?.minimize();
  const maximize = () => window.dax?.window?.maximize();
  const close = () => window.dax?.window?.close();

  return (
    <div className="titlebar-drag flex items-center justify-between h-[var(--dax-titlebar-h,32px)] bg-dax-titlebar border-b border-dax-panel-border px-3 select-none shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 titlebar-no-drag">
        <div className="w-4 h-4 rounded bg-dax-accent flex items-center justify-center">
          <span className="text-[8px] font-bold text-white leading-none">D</span>
        </div>
        <span className="font-brand text-xs tracking-wider text-dax-text-bright">DAX</span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center titlebar-no-drag">
        <button
          onClick={minimize}
          className="w-[46px] h-8 flex items-center justify-center hover:bg-dax-list-hover transition-fast"
          aria-label="Minimize"
        >
          <Minus size={14} className="text-dax-text-dim" />
        </button>
        <button
          onClick={maximize}
          className="w-[46px] h-8 flex items-center justify-center hover:bg-dax-list-hover transition-fast"
          aria-label="Maximize"
        >
          <Square size={11} className="text-dax-text-dim" />
        </button>
        <button
          onClick={close}
          className="w-[46px] h-8 flex items-center justify-center hover:bg-[rgb(232_17_35)] group transition-fast"
          aria-label="Close"
        >
          <X size={14} className="text-dax-text-dim group-hover:text-white" />
        </button>
      </div>
    </div>
  );
}
