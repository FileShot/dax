import { useState, useEffect } from 'react';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
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
  marketplace: () => <PlaceholderView title="Marketplace" description="Browse and install community agents" />,
  settings: SettingsView,
};

function PlaceholderView({ title, description }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-dax-text-bright mb-2">{title}</h2>
        <p className="text-dax-text-dim text-sm">{description}</p>
        <p className="text-dax-text-dim text-xs mt-4 opacity-50">Coming soon</p>
      </div>
    </div>
  );
}

export default function Layout() {
  const [activeView, setActiveView] = useState('dashboard');
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
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <main className="flex-1 overflow-auto">
          <ViewComponent onNavigate={setActiveView} />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
