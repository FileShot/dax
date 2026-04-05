import { useState } from 'react';
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  History,
  Store,
  Settings,
  Zap,
  MessageSquarePlus,
  Plug,
  Mic,
  ChevronLeft,
  Users,
  Database,
  Activity,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'agents', icon: Bot, label: 'Agents' },
  { id: 'crews', icon: Users, label: 'Crews' },
  { id: 'knowledge', icon: Database, label: 'Knowledge' },
  { id: 'builder', icon: GitBranch, label: 'Builder' },
  { id: 'chat-builder', icon: MessageSquarePlus, label: 'Chat Builder' },
  { id: 'integrations', icon: Plug, label: 'Integrations' },
  { id: 'health', icon: Activity, label: 'Health' },
  { id: 'voice-plugins', icon: Mic, label: 'Voice & Plugins' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'marketplace', icon: Store, label: 'Marketplace' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ activeView, onViewChange }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`flex flex-col bg-dax-sidebar border-r border-dax-panel-border shrink-0 transition-smooth ${
        collapsed ? 'w-[var(--dax-nav-icon-w,56px)]' : 'w-[var(--dax-sidebar-w,240px)]'
      }`}
    >
      {/* Brand */}
      <div className={`flex items-center gap-2.5 px-4 py-4 border-b border-dax-panel-border/50 ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="w-7 h-7 rounded-lg bg-dax-accent/10 flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-dax-accent" />
        </div>
        {!collapsed && (
          <span className="text-sm font-bold tracking-wide text-dax-text-bright" style={{ fontFamily: 'Audiowide, sans-serif' }}>
            DAX
          </span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-0.5 p-2 pt-3 overflow-y-auto">
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              className={`nav-item relative flex items-center gap-3 px-3 py-2 rounded-lg text-left w-full ${
                isActive
                  ? 'bg-dax-accent/8 text-dax-accent'
                  : 'text-dax-text-dim hover:bg-dax-list-hover hover:text-dax-text'
              }`}
              title={collapsed ? label : undefined}
            >
              {isActive && (
                <div className="nav-indicator absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-dax-accent rounded-r" />
              )}
              <Icon size={18} />
              {!collapsed && (
                <span className="text-[13px] font-medium truncate">{label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-2 border-t border-dax-panel-border/50">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-dax-text-dim hover:bg-dax-list-hover hover:text-dax-text transition-fast w-full"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronLeft size={18} className={`transition-smooth ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && (
            <span className="text-[13px] font-medium">Collapse</span>
          )}
        </button>
      </div>
    </div>
  );
}
