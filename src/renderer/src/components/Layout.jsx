import { useState, useEffect } from 'react';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import ChatPanel from './ChatPanel';
import useRunStore from '../stores/useRunStore';
import DashboardView from '../views/DashboardView';
import AgentsView from '../views/AgentsView';
import BuilderView from '../views/BuilderView';
import ChatBuilderView from '../views/ChatBuilderView';
import HistoryView from '../views/HistoryView';
import IntegrationsView from '../views/IntegrationsView';
import HealthView from '../views/HealthView';
import VoicePluginsView from '../views/VoicePluginsView';
import CrewsView from '../views/CrewsView';
import KnowledgeBaseView from '../views/KnowledgeBaseView';
import SettingsView from '../views/SettingsView';
import ModelsView from '../views/ModelsView';
import MarketplaceView from '../views/MarketplaceView';

const views = {
  dashboard: DashboardView,
  agents: AgentsView,
  crews: CrewsView,
  knowledge: KnowledgeBaseView,
  builder: BuilderView,
  'chat-builder': ChatBuilderView,
  history: HistoryView,
  integrations: IntegrationsView,
  health: HealthView,
  'voice-plugins': VoicePluginsView,
  models: ModelsView,
  marketplace: MarketplaceView,
  settings: SettingsView,
};

export default function Layout() {
  const [activeView, setActiveView] = useState('dashboard');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const ViewComponent = views[activeView] || views.dashboard;
  const initLiveTracking = useRunStore((s) => s.initLiveTracking);

  useEffect(() => {
    const cleanup = initLiveTracking();
    return () => cleanup?.();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-dax-bg">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen(!chatOpen)}
        />
        <main className="flex-1 overflow-hidden flex flex-row">
          <div className="flex-1 overflow-auto">
            <ViewComponent onNavigate={setActiveView} onOpenChat={() => setChatOpen(true)} />
          </div>
          <ChatPanel
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            expanded={chatExpanded}
            onToggleExpand={() => setChatExpanded(!chatExpanded)}
          />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
