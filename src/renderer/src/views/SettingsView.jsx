import { useEffect, useState } from 'react';
import { useTheme, themeList } from '../components/ThemeProvider';
import useSettingsStore from '../stores/useSettingsStore';
import {
  Palette,
  Monitor,
  FolderOpen,
  Database,
  FileText,
  Info,
  ChevronRight,
  Check,
} from 'lucide-react';

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'general', label: 'General', icon: Monitor },
  { id: 'paths', label: 'Paths & Storage', icon: FolderOpen },
  { id: 'about', label: 'About', icon: Info },
];

function ThemeCard({ t, isActive, onSelect }) {
  const bg = `rgb(${t.colors.bg})`;
  const sidebar = `rgb(${t.colors.sidebar})`;
  const accent = `rgb(${t.colors.accent})`;
  const card = `rgb(${t.colors.card})`;
  const text = `rgb(${t.colors.text})`;
  const textDim = `rgb(${t.colors['text-dim']})`;

  return (
    <button
      onClick={() => onSelect(t.id)}
      className={`relative text-left p-3 rounded-lg border transition-fast ${
        isActive
          ? 'border-dax-accent bg-dax-accent/8'
          : 'border-dax-card-border bg-dax-card hover:bg-dax-card-hover'
      }`}
    >
      {isActive && (
        <div className="absolute top-2 right-2">
          <Check size={12} className="text-dax-accent" />
        </div>
      )}
      {/* Mini preview */}
      <div className="w-full h-14 rounded mb-2 overflow-hidden flex" style={{ background: bg }}>
        <div className="w-5 h-full" style={{ background: sidebar }} />
        <div className="flex-1 p-1.5 flex flex-col gap-1">
          <div className="h-1.5 w-8 rounded-sm" style={{ background: accent }} />
          <div className="flex gap-1 flex-1">
            <div className="flex-1 rounded-sm" style={{ background: card }} />
            <div className="flex-1 rounded-sm" style={{ background: card }} />
          </div>
          <div className="h-1 w-12 rounded-sm" style={{ background: textDim, opacity: 0.5 }} />
        </div>
      </div>
      <div className="text-xs font-medium text-dax-text-bright">{t.name}</div>
      <div className="text-[10px] text-dax-text-dim capitalize mt-0.5">{t.type}</div>
    </button>
  );
}

function AppearanceSection() {
  const { themeId, setTheme } = useTheme();

  return (
    <div>
      <h3 className="text-sm font-medium text-dax-text-bright mb-1">Theme</h3>
      <p className="text-xs text-dax-text-dim mb-4">Choose a color theme for the interface</p>
      <div className="grid grid-cols-4 gap-3">
        {themeList.map((t) => (
          <ThemeCard key={t.id} t={t} isActive={themeId === t.id} onSelect={setTheme} />
        ))}
      </div>
    </div>
  );
}

function GeneralSection() {
  const settingsStore = useSettingsStore();
  const [autoStart, setAutoStart] = useState(false);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    settingsStore.fetchAll();
  }, []);

  const handleToggle = async (key, value, setter) => {
    setter(value);
    await settingsStore.set(key, JSON.stringify(value));
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-medium text-dax-text-bright mb-4">General Preferences</h3>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between agent-card p-3">
            <div>
              <div className="text-xs font-medium text-dax-text">Auto-start agents on launch</div>
              <div className="text-[10px] text-dax-text-dim mt-0.5">Resume enabled agents when Dax starts</div>
            </div>
            <button
              onClick={() => handleToggle('autoStart', !autoStart, setAutoStart)}
              className={`relative w-9 h-5 rounded-full transition-fast ${
                autoStart ? 'bg-dax-accent' : 'bg-dax-input-border'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-fast ${
                autoStart ? 'left-[18px]' : 'left-0.5'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between agent-card p-3">
            <div>
              <div className="text-xs font-medium text-dax-text">Desktop notifications</div>
              <div className="text-[10px] text-dax-text-dim mt-0.5">Show alerts when agent runs complete or fail</div>
            </div>
            <button
              onClick={() => handleToggle('notifications', !notifications, setNotifications)}
              className={`relative w-9 h-5 rounded-full transition-fast ${
                notifications ? 'bg-dax-accent' : 'bg-dax-input-border'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-fast ${
                notifications ? 'left-[18px]' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PathsSection() {
  const [paths, setPaths] = useState({ userData: '', modelsDir: '', logPath: '' });

  useEffect(() => {
    if (!window.dax) return;
    Promise.all([
      window.dax.system.userData(),
      window.dax.system.modelsDir(),
      window.dax.system.logPath(),
    ]).then(([userData, modelsDir, logPath]) => {
      setPaths({ userData, modelsDir, logPath });
    }).catch((err) => console.error('[Settings] Failed to load paths:', err));
  }, []);

  const openFolder = (p) => {
    if (p && window.dax?.openFolder) window.dax.openFolder(p);
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-dax-text-bright mb-4">Paths & Storage</h3>
      <div className="flex flex-col gap-3">
        {[
          { label: 'User Data', icon: Database, path: paths.userData },
          { label: 'Models Directory', icon: FolderOpen, path: paths.modelsDir },
          { label: 'Log File', icon: FileText, path: paths.logPath },
        ].map(({ label, icon: Icon, path }) => (
          <div key={label} className="agent-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Icon size={14} className="text-dax-text-dim shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-dax-text">{label}</div>
                <div className="text-[10px] text-dax-text-dim truncate mt-0.5">{path || 'Loading...'}</div>
              </div>
            </div>
            <button
              onClick={() => openFolder(path)}
              className="text-dax-text-dim hover:text-dax-accent transition-fast shrink-0 ml-3"
              title="Open in explorer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AboutSection() {
  const [systemInfo, setSystemInfo] = useState(null);

  useEffect(() => {
    if (!window.dax) return;
    window.dax.system.info()
      .then(setSystemInfo)
      .catch((err) => console.error('[Settings] Failed to load system info:', err));
  }, []);

  return (
    <div>
      <h3 className="text-sm font-medium text-dax-text-bright mb-4">About Dax</h3>

      <div className="agent-card p-5 mb-5 text-center">
        <div className="w-12 h-12 rounded-xl bg-dax-accent flex items-center justify-center mx-auto mb-3">
          <span className="text-lg font-bold text-white font-brand">D</span>
        </div>
        <div className="text-base font-brand text-dax-text-bright tracking-wider">DAX</div>
        <div className="text-xs text-dax-text-dim mt-1">Privacy-first AI Agent Platform</div>
        <div className="text-[10px] text-dax-text-dim mt-2">v0.1.0</div>
      </div>

      {systemInfo && (
        <div className="grid grid-cols-2 gap-3">
          <div className="agent-card p-3">
            <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Platform</div>
            <div className="text-xs text-dax-text">{systemInfo.platform}</div>
          </div>
          <div className="agent-card p-3">
            <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Architecture</div>
            <div className="text-xs text-dax-text">{systemInfo.arch}</div>
          </div>
          <div className="agent-card p-3">
            <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">CPU Cores</div>
            <div className="text-xs text-dax-text">{systemInfo.cpus}</div>
          </div>
          <div className="agent-card p-3">
            <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Memory</div>
            <div className="text-xs text-dax-text">{Math.round(systemInfo.totalMemory / 1024 / 1024 / 1024)} GB</div>
          </div>
          <div className="agent-card p-3">
            <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Electron</div>
            <div className="text-xs text-dax-text">{systemInfo.versions?.electron}</div>
          </div>
          <div className="agent-card p-3">
            <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Node.js</div>
            <div className="text-xs text-dax-text">{systemInfo.versions?.node}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const SECTION_COMPONENTS = {
  appearance: AppearanceSection,
  general: GeneralSection,
  paths: PathsSection,
  about: AboutSection,
};

export default function SettingsView() {
  const [activeSection, setActiveSection] = useState('appearance');
  const SectionComponent = SECTION_COMPONENTS[activeSection];

  return (
    <div className="flex h-full">
      {/* Left Nav */}
      <div className="w-[200px] border-r border-dax-panel-border p-3 shrink-0">
        <h1 className="text-base font-semibold text-dax-text-bright px-3 mb-3">Settings</h1>
        <div className="flex flex-col gap-0.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-fast w-full text-left ${
                activeSection === id
                  ? 'bg-dax-accent/10 text-dax-accent'
                  : 'text-dax-text-dim hover:bg-dax-list-hover hover:text-dax-text'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-2xl">
        <SectionComponent />
      </div>
    </div>
  );
}
