/**
 * GuidedTour — first-run spotlight walkthrough.
 *
 * - Dims the page with a full-screen overlay, leaving a cutout over the target element.
 * - Shows a tooltip bubble next to the target with "Back / Next / Finish" + a prominent
 *   "Skip Tour" button fixed in the top-right that is ALWAYS visible.
 * - Persists completion/skipped state in localStorage under `dax-tour-completed`.
 * - Can be restarted via the useGuidedTour().start() hook, exposed on window for Help menus.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'dax-tour-completed';

// Each step targets a `data-tour="<id>"` element. If the element is missing the
// step falls back to a centered explanation card.
export const DEFAULT_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Dax',
    body: 'Dax is a local-first AI agent platform. Build agents, give them tools, and let them run unattended for hours or days. No cloud lock-in.',
  },
  {
    id: 'sidebar',
    target: 'sidebar',
    placement: 'right',
    title: 'Navigate here',
    body: 'Everything lives in this rail — Agents, Crews, Models, the visual Builder, Integrations, and Health monitoring.',
  },
  {
    id: 'models',
    target: 'nav-models',
    placement: 'right',
    title: 'Start with a model',
    body: 'Dax runs GGUF models locally via llama.cpp. Download a curated pick or search HuggingFace directly.',
  },
  {
    id: 'agents',
    target: 'nav-agents',
    placement: 'right',
    title: 'Build your first agent',
    body: 'Agents are the unit of automation. They have a trigger (manual, schedule, webhook, file-watch, event), a model, and a workflow.',
  },
  {
    id: 'builder',
    target: 'nav-builder',
    placement: 'right',
    title: 'Compose workflows visually',
    body: 'The Builder lets you wire triggers → tools → actions into a flow without writing boilerplate.',
  },
  {
    id: 'integrations',
    target: 'nav-integrations',
    placement: 'right',
    title: 'Plug into real services',
    body: '180+ real integrations (Slack, Notion, Stripe, Postgres, MySQL, MCP servers, and more). Connect via API key or OAuth.',
  },
  {
    id: 'chat',
    target: 'nav-chat',
    placement: 'right',
    title: 'Talk to Dax',
    body: 'The Chat panel is your interactive assistant. It can invoke your agents, tools, and knowledge base on the fly.',
  },
  {
    id: 'done',
    title: "You're ready",
    body: 'You can restart this tour any time from Help → Guided Tour. Have fun building.',
  },
];

const TourCtx = createContext(null);

export function useGuidedTour() {
  const ctx = useContext(TourCtx);
  if (!ctx) throw new Error('useGuidedTour must be used inside <GuidedTourProvider>');
  return ctx;
}

export default function GuidedTourProvider({ children, steps = DEFAULT_STEPS }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // On mount, auto-start if not completed.
  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) {
        // Defer so the sidebar + nav items mount first.
        const t = setTimeout(() => setActive(true), 400);
        return () => clearTimeout(t);
      }
    } catch (_) {}
  }, []);

  const start = useCallback(() => { setStepIndex(0); setActive(true); }, []);
  const stop = useCallback((markComplete = true) => {
    setActive(false);
    if (markComplete) {
      try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch (_) {}
    }
  }, []);
  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= steps.length - 1) { stop(true); return i; }
      return i + 1;
    });
  }, [steps.length, stop]);
  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  // Expose globally for Help menus.
  useEffect(() => {
    window.__daxTour = { start, stop };
    return () => { if (window.__daxTour) delete window.__daxTour; };
  }, [start, stop]);

  const value = useMemo(() => ({ active, start, stop, next, back, stepIndex, steps }), [active, start, stop, next, back, stepIndex, steps]);

  return (
    <TourCtx.Provider value={value}>
      {children}
      {active && <TourOverlay />}
    </TourCtx.Provider>
  );
}

function TourOverlay() {
  const { steps, stepIndex, next, back, stop } = useGuidedTour();
  const step = steps[stepIndex];
  const [rect, setRect] = useState(null);
  const tipRef = useRef(null);

  // Recompute target rect on step change and window resize.
  useLayoutEffect(() => {
    function update() {
      if (!step?.target) { setRect(null); return; }
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
    update();
    window.addEventListener('resize', update);
    const interval = setInterval(update, 400); // track layout shifts
    return () => { window.removeEventListener('resize', update); clearInterval(interval); };
  }, [step]);

  // Keyboard nav.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') stop(true);
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') back();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, stop]);

  const isLast = stepIndex >= steps.length - 1;

  // Compute tooltip position next to target (or centered if no target).
  const pad = 12;
  let tipStyle;
  if (rect) {
    const placement = step.placement || 'right';
    if (placement === 'right') {
      tipStyle = { top: Math.max(16, rect.top + rect.height / 2 - 90), left: rect.left + rect.width + pad };
    } else if (placement === 'left') {
      tipStyle = { top: Math.max(16, rect.top + rect.height / 2 - 90), right: window.innerWidth - rect.left + pad };
    } else if (placement === 'bottom') {
      tipStyle = { top: rect.top + rect.height + pad, left: Math.max(16, rect.left) };
    } else {
      tipStyle = { bottom: window.innerHeight - rect.top + pad, left: Math.max(16, rect.left) };
    }
  } else {
    tipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-none">
      {/* Spotlight mask — SVG rect cutout for the target */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={() => next()}>
        <defs>
          <mask id="dax-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#dax-tour-mask)" />
        {rect && (
          <rect
            x={rect.left - 6}
            y={rect.top - 6}
            width={rect.width + 12}
            height={rect.height + 12}
            rx="10"
            fill="none"
            stroke="rgb(var(--dax-accent))"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        )}
      </svg>

      {/* Skip button — ALWAYS top-right, above everything */}
      <button
        onClick={() => stop(true)}
        className="pointer-events-auto fixed top-4 right-4 z-[1010] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.06em] bg-white/10 hover:bg-white/15 text-white border border-white/20 backdrop-blur-sm shadow-lg transition-colors"
        title="Skip tour (Esc)"
      >
        <X size={13} /> Skip Tour
      </button>

      {/* Tooltip card */}
      <div
        ref={tipRef}
        className="pointer-events-auto absolute w-[320px] max-w-[92vw] rounded-xl border border-white/[0.14] bg-dax-panel/95 backdrop-blur-md shadow-2xl p-4 text-dax-text"
        style={tipStyle}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-dax-accent/15 flex items-center justify-center">
            <Sparkles size={12} className="text-dax-accent" />
          </div>
          <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-dax-text-dim">
            Step {stepIndex + 1} of {steps.length}
          </span>
        </div>
        <h3 className="text-[15px] font-semibold text-dax-text-bright mb-1.5">{step.title}</h3>
        <p className="text-[12px] leading-relaxed text-dax-text">{step.body}</p>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={back}
            disabled={stepIndex === 0}
            className="btn-ghost btn-sm disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowLeft size={11} /> Back
          </button>
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === stepIndex ? 'bg-dax-accent' : 'bg-white/20'}`}
              />
            ))}
          </div>
          <button onClick={next} className="btn-primary btn-sm">
            {isLast ? 'Finish' : 'Next'} <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
