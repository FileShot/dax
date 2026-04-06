import { useState, useEffect, useCallback } from 'react';
import { HelpCircle, X, ChevronRight } from 'lucide-react';

const GUIDES = {
  dashboard: {
    title: 'Dashboard Guide',
    sections: [
      {
        heading: 'Overview',
        content: 'The Dashboard gives you a real-time snapshot of your entire Dax setup — agents, runs, system health, and service metrics all in one place.',
      },
      {
        heading: 'Stats Row',
        content: 'The top row shows total agents configured, how many are currently active, recent run count, success rate, and error count. These update automatically when runs start or complete.',
      },
      {
        heading: 'Agents Section',
        content: 'Shows your configured agents as cards. Active agents display a "Live" badge with step count. Click "View all" to go to the Agents page.',
      },
      {
        heading: 'System, Models & Integrations',
        content: 'System shows CPU/RAM usage. Models lists configured LLM endpoints. Integrations shows circuit breaker health (CLOSED = healthy, OPEN = failing).',
      },
      {
        heading: 'Live Activity',
        content: 'Real-time feed of agent execution steps as they happen. Latest Results shows output from completed runs. Recent shows the last 8 run statuses.',
      },
      {
        heading: 'Service Metrics',
        content: 'Live counters and timing data from the backend: run counts, token usage, memory, DB size, IPC call stats, and latency histograms. Refreshes every 10 seconds.',
      },
      {
        heading: 'Output Files',
        content: 'Browse files created by agent runs in the test-output/ directory. Click a file to view its contents.',
      },
    ],
  },

  agents: {
    title: 'Agents Guide',
    sections: [
      {
        heading: 'What are Agents?',
        content: 'Agents are autonomous AI workers that execute tasks on a schedule, via webhook, or on demand. Each agent has a name, model, system prompt, and trigger configuration.',
      },
      {
        heading: 'Creating an Agent',
        content: 'Click "New Agent" and fill in: Name (required), Model (pick from configured LLMs), System Prompt (what the agent should do), Trigger Type (manual, schedule, webhook, or file watch), and optional integrations/tools.',
      },
      {
        heading: 'Trigger Types',
        content: 'Manual: run on demand. Schedule: cron expression like "*/5 * * * *" (every 5 min). Webhook: triggered by HTTP POST to a unique URL. File Watch: triggers when a file changes.',
      },
      {
        heading: 'Cron Syntax',
        content: 'Cron format: minute hour day-of-month month day-of-week. Examples: "*/5 * * * *" = every 5 min, "0 9 * * 1-5" = 9 AM weekdays, "0 */2 * * *" = every 2 hours.',
      },
      {
        heading: 'Enable/Disable',
        content: 'Toggle the switch on an agent card to enable or disable it. Disabled agents won\'t run on their schedule but are preserved in the database.',
      },
      {
        heading: 'Running an Agent',
        content: 'Click the play button on any agent card to trigger a manual run. You can watch progress in real-time on the Dashboard or History pages.',
      },
    ],
  },

  crews: {
    title: 'Crews Guide',
    sections: [
      {
        heading: 'What are Crews?',
        content: 'Crews let multiple agents collaborate on a task. Agents take turns in rounds, sharing context and building on each other\'s work.',
      },
      {
        heading: 'Creating a Crew',
        content: 'Click "New Crew," name it, add agents as members with specific roles, set the max rounds, and define the objective. The crew will run each agent in sequence per round.',
      },
      {
        heading: 'Execution Flow',
        content: 'Round 1: Agent A runs → Agent B runs → Agent C runs. Round 2: same order, with shared context. The crew stops when an agent returns "crew_done" or max rounds are hit.',
      },
      {
        heading: 'Use Cases',
        content: 'Research + Summarize: one agent gathers data, another writes a report. Code + Review: one generates code, another reviews it. Multi-step workflows with handoffs.',
      },
    ],
  },

  models: {
    title: 'Models Guide',
    sections: [
      {
        heading: 'What are Models?',
        content: 'Models are LLM endpoints your agents use for AI reasoning. Dax supports Ollama (local), OpenAI, Anthropic, and any OpenAI-compatible API.',
      },
      {
        heading: 'Adding a Model',
        content: 'Select a provider, enter the API endpoint URL and API key (if needed), then pick the model name. For Ollama, the default is http://localhost:11434/v1.',
      },
      {
        heading: 'Local Models (Ollama)',
        content: 'Install Ollama, then pull a model: "ollama pull qwen3.5:0.8b". The model will appear in Dax automatically. Smaller models (0.5-3B) are fastest; larger ones (7B+) are smarter.',
      },
      {
        heading: 'HuggingFace Models',
        content: 'Search and download GGUF models directly from HuggingFace. These can be loaded into Ollama or used with llama.cpp.',
      },
      {
        heading: 'Tips',
        content: 'Start with a small model for testing (qwen3.5:0.8b). Use larger models for complex tasks. Check the Health page if a model seems slow or unresponsive.',
      },
    ],
  },

  knowledge: {
    title: 'Knowledge Base Guide',
    sections: [
      {
        heading: 'What is a Knowledge Base?',
        content: 'Knowledge Bases let you feed custom documents to your agents. Upload files and they\'re chunked, embedded, and searchable via RAG (Retrieval Augmented Generation).',
      },
      {
        heading: 'Creating a KB',
        content: 'Click "New Knowledge Base," name it, then upload files (.txt, .md, .pdf, .json, .csv). Files are split into chunks and embedded for semantic search.',
      },
      {
        heading: 'Using a KB with Agents',
        content: 'When creating or editing an agent, attach a Knowledge Base. The agent will automatically search relevant chunks when answering questions.',
      },
      {
        heading: 'Supported Formats',
        content: 'Text (.txt), Markdown (.md), PDF, JSON, CSV. Larger files are split into overlapping chunks for better retrieval.',
      },
    ],
  },

  builder: {
    title: 'Builder Guide',
    sections: [
      {
        heading: 'Visual Agent Builder',
        content: 'The Builder provides a node-based visual editor for creating complex agent workflows. Drag nodes, connect them with edges, and define execution paths.',
      },
      {
        heading: 'Node Types',
        content: 'LLM Node: calls the AI model. Tool Node: executes a tool/integration. Condition Node: branches based on output. Start/End: entry and exit points.',
      },
      {
        heading: 'Building a Workflow',
        content: 'Select an agent from the dropdown, then click "Add Node" to add nodes. Connect outputs to inputs by dragging between node ports. Save when done.',
      },
      {
        heading: 'Tips',
        content: 'Keep workflows simple — most agents work fine with just an LLM node. Use the Builder when you need conditional logic or multi-step tool chains.',
      },
    ],
  },

  chatBuilder: {
    title: 'Chat Builder Guide',
    sections: [
      {
        heading: 'Build Agents with Chat',
        content: 'Describe what you want your agent to do in natural language, and Dax will create the agent configuration for you. Like ChatGPT for building agents.',
      },
      {
        heading: 'Example Prompts',
        content: 'Try: "Build me an agent that monitors Bitcoin prices every 5 minutes" or "Create a weather agent for New York that runs hourly." The AI will generate the name, prompt, schedule, and tools.',
      },
      {
        heading: 'Tips',
        content: 'Be specific about what the agent should do, how often, and what tools/integrations it needs. You can refine the generated agent afterward in the Agents page.',
      },
    ],
  },

  integrations: {
    title: 'Integrations Guide',
    sections: [
      {
        heading: 'What are Integrations?',
        content: 'Integrations connect your agents to external services — Slack, Discord, GitHub, email, databases, APIs, and more. Agents can use these as tools during execution.',
      },
      {
        heading: 'Connecting an Integration',
        content: 'Find the integration in the list, click "Connect," and enter the required credentials (API keys, tokens, etc.). Click "Test" to verify the connection works.',
      },
      {
        heading: 'Using Integrations',
        content: 'Once connected, add integrations to agents via the agent editor. The agent can then call integration actions (send message, create issue, query database, etc.).',
      },
      {
        heading: 'Available Categories',
        content: 'Communication (Slack, Discord, Telegram, Email), Development (GitHub, Jira), Data (Google Sheets, databases), Productivity (Google Calendar, Notion), Utility (HTTP/REST, Filesystem).',
      },
      {
        heading: 'Troubleshooting',
        content: 'If an integration fails, check the Health page for circuit breaker status. Re-test the connection. Ensure API keys haven\'t expired. Check rate limits.',
      },
    ],
  },

  health: {
    title: 'Health Monitor Guide',
    sections: [
      {
        heading: 'Integration Health',
        content: 'This page shows the circuit breaker state for every integration your agents use. It helps you identify which external services are having issues.',
      },
      {
        heading: 'Circuit Breaker States',
        content: 'CLOSED (green): Working normally. HALF_OPEN (yellow): Recovering, testing with probe requests. OPEN (red): Failing — requests are blocked to prevent cascading failures.',
      },
      {
        heading: 'How It Works',
        content: 'After 5 consecutive failures, the circuit opens and blocks requests for 60 seconds. Then it moves to half-open, allowing 2 test requests. If those succeed, it closes again.',
      },
      {
        heading: 'What to Do',
        content: 'If a circuit is OPEN: check the external service\'s status page, verify credentials, check rate limits. The circuit will auto-recover once the service is back.',
      },
    ],
  },

  voicePlugins: {
    title: 'Voice & Plugins Guide',
    sections: [
      {
        heading: 'Voice',
        content: 'Configure text-to-speech and speech-to-text for agent interactions. Supports local and cloud voice providers.',
      },
      {
        heading: 'Plugins',
        content: 'Extend Dax with custom plugins. Plugins can add new tools, integrations, or UI components. Place plugin files in the plugins/ directory.',
      },
      {
        heading: 'MCP Servers',
        content: 'Connect to Model Context Protocol (MCP) servers to give agents access to external tool servers. Configure server URLs and authentication.',
      },
    ],
  },

  history: {
    title: 'History Guide',
    sections: [
      {
        heading: 'Run History',
        content: 'View all past agent runs with timestamps, status, duration, and token usage. Search by agent name or filter by status.',
      },
      {
        heading: 'Status Types',
        content: 'Completed (green): finished successfully. Error (red): failed with an error. Running (blue, spinning): still executing. Cancelled (yellow): manually stopped.',
      },
      {
        heading: 'Run Details',
        content: 'Click a run to see full output, step-by-step execution log, tool calls made, tokens consumed, and any errors encountered.',
      },
      {
        heading: 'Filtering',
        content: 'Use the search bar to find runs by agent name. Click status buttons (All, Completed, Error, Running) to filter. Results are sorted newest-first.',
      },
    ],
  },

  settings: {
    title: 'Settings Guide',
    sections: [
      {
        heading: 'General',
        content: 'Configure default model, API endpoints, data directory, and other global preferences.',
      },
      {
        heading: 'Security',
        content: 'Manage webhook tokens, API keys, and authentication settings. Credentials are encrypted at rest using AES-256-GCM.',
      },
      {
        heading: 'Data',
        content: 'Database is stored at ~/.dax/dax.db (SQLite). Backups are created automatically every 24 hours in the backups/ directory. Logs rotate after 7 days or 50 MB.',
      },
      {
        heading: 'Advanced',
        content: 'Max concurrent runs, token budgets, retry settings, log verbosity, and webhook server configuration.',
      },
    ],
  },

  chat: {
    title: 'Chat Guide',
    sections: [
      {
        heading: 'Chat with Dax',
        content: 'Ask questions about your agents, their status, recent activity, and results. The chat is aware of all running agents and their recent output.',
      },
      {
        heading: 'Agent Awareness',
        content: 'The chat model receives a live system prompt with current agent status, scheduler state, and recent run results. Ask "What are my agents doing?" for a summary.',
      },
      {
        heading: 'Tips',
        content: 'Try: "Which agents ran in the last hour?", "Show me errors from bitcoin-tracker", "What did the weather agent report?" The AI will answer based on real agent data.',
      },
    ],
  },

  marketplace: {
    title: 'Marketplace Guide',
    sections: [
      {
        heading: 'Agent Marketplace',
        content: 'Browse and install pre-built agent templates, integrations, and plugins shared by the community.',
      },
      {
        heading: 'Publishing',
        content: 'Share your own agents and integrations with the Dax community. Export an agent config and submit it to the marketplace.',
      },
    ],
  },
};

export default function HelpGuide({ page }) {
  const [isOpen, setIsOpen] = useState(false);
  const guide = GUIDES[page];

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!guide) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-dax-text-dim hover:text-dax-accent hover:bg-dax-accent/10 transition-fast"
        title={`${guide.title}`}
      >
        <HelpCircle size={14} />
        <span>Guide</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          {/* Modal */}
          <div className="relative bg-dax-panel border border-dax-panel-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dax-panel-border">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-dax-accent" />
                <h2 className="text-sm font-semibold text-dax-text-bright">{guide.title}</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-dax-card text-dax-text-dim hover:text-dax-text transition-fast"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-4 space-y-4">
              {guide.sections.map((section, i) => (
                <div key={i}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <ChevronRight size={12} className="text-dax-accent" />
                    <h3 className="text-xs font-semibold text-dax-text-bright">{section.heading}</h3>
                  </div>
                  <p className="text-xs text-dax-text-dim leading-relaxed pl-5">{section.content}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-dax-panel-border text-center">
              <span className="text-[10px] text-dax-text-dim">Press Esc or click outside to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
