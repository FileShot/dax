# Dax Architecture

## Overview

Dax is a privacy-first AI agent platform that runs entirely on the user's machine. It supports two runtime modes: **Electron desktop app** and **standalone web server**.

```
┌─────────────────────────────────────────────────┐
│                   RENDERER                       │
│  React 19 + Zustand + Tailwind                  │
│  Views: Dashboard, Agents, History, Chat, ...    │
│                                                  │
│  ┌──────────┐  ┌──────────┐                     │
│  │ preload  │  │ws-bridge │                     │
│  │(Electron)│  │(Browser) │                     │
│  └────┬─────┘  └────┬─────┘                     │
└───────┼──────────────┼───────────────────────────┘
        │ IPC          │ WebSocket
        ▼              ▼
┌──────────────────────────────────────────────────┐
│              MAIN PROCESS                         │
│                                                   │
│  ┌──────────────┐   ┌──────────────────┐         │
│  │   main.js    │   │  web-server.js   │         │
│  │  (Electron)  │   │  (HTTP + WS)     │         │
│  └──────┬───────┘   └────────┬─────────┘         │
│         │ child_process.fork()│                   │
│         ▼                    ▼                    │
│  ┌────────────────────────────────────────┐       │
│  │         agent-service.js               │       │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ │       │
│  │  │ sql.js  │ │scheduler │ │ runner │ │       │
│  │  │  (DB)   │ │(node-cron)│ │        │ │       │
│  │  └─────────┘ └──────────┘ └────────┘ │       │
│  │  ┌──────────────────────────────────┐ │       │
│  │  │        500 Integrations          │ │       │
│  │  └──────────────────────────────────┘ │       │
│  │  ┌──────────────────────────────────┐ │       │
│  │  │     Webhook Server (:3700)       │ │       │
│  │  └──────────────────────────────────┘ │       │
│  └────────────────────────────────────────┘       │
└──────────────────────────────────────────────────┘
        │
        ▼
┌──────────────┐
│   Ollama     │
│ (localhost:  │
│  11434)      │
└──────────────┘
```

## Process Architecture

### Electron Mode
```
Electron main (main.js)
  └─ child_process.fork() → agent-service.js
       ├── SQLite (sql.js in-memory)
       ├── Scheduler (node-cron)
       ├── Agent Runner (LLM calls)
       ├── 500 Integrations
       └── Webhook HTTP Server (:3700)
```

### Web Server Mode
```
Node.js (web-server.js)
  ├── HTTP server (:3800) → serves React SPA
  ├── WebSocket server → proxies IPC to service
  └─ child_process.fork() → agent-service.js
       └── (same as above)
```

### Why child_process?
The agent-service runs as a separate process so that:
- Agent execution doesn't block the UI process
- Service survives window close (agents keep running)
- Crashes in agent code don't crash the Electron app
- Memory isolation between UI and agent workloads

---

## Data Flow

### Agent Execution
```
1. Trigger (manual/cron/webhook)
   ↓
2. Scheduler creates Run record (status: pending)
   ↓
3. Runner loads agent config + system prompt
   ↓
4. Runner calls Ollama LLM (with tool definitions)
   ↓
5. LLM returns text or tool_calls
   ↓
6. Runner executes tools (http_request, write_file, etc.)
   ↓
7. Tool results fed back to LLM (loop: max 10 iterations)
   ↓
8. Final response saved to Run record (status: completed/error)
   ↓
9. Events broadcast to UI (run-completed)
```

### IPC Message Flow (Web Mode)
```
Browser                WebSocket             web-server.js          agent-service.js
  │                       │                       │                       │
  │──invoke(agents-list)──→                       │                       │
  │                       │──{invoke,id,channel}──→                       │
  │                       │                       │──process.send(msg)───→│
  │                       │                       │                       │── DB query
  │                       │                       │←──process.send(res)───│
  │                       │←──{response,id,data}──│                       │
  │←──callback(data)──────│                       │                       │
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **sql.js (in-memory SQLite)** | Zero external dependencies. No PostgreSQL/MySQL install. Single-file database. Portable across platforms. |
| **child_process over worker_threads** | True process isolation. Agent crashes can't corrupt parent. Easier to restart/monitor. |
| **500 built-in integrations** | Users should never need to write API code. Every integration follows the same shape (id, configFields, actions). |
| **node-cron for scheduling** | Simple, zero-dependency cron parser. No external scheduler service needed. |
| **Zustand over Redux** | Minimal boilerplate. React 19 compatible. Simpler mental model for store management. |
| **Tailwind over CSS modules** | Consistent design tokens. Fast iteration. Dark theme via utility classes. |
| **No TypeScript** | Faster iteration during early development. Zod provides runtime validation at system boundaries. |

---

## Directory Structure

```
dax/
├── src/
│   ├── main/                    # Backend (Node.js)
│   │   ├── main.js              # Electron main process
│   │   ├── preload.js           # Electron preload (window.dax API)
│   │   ├── web-server.js        # HTTP + WS server for browser mode
│   │   ├── agent-service.js     # Core service (DB, handlers, webhook)
│   │   ├── credential-store.js  # OS keychain + AES-256-GCM encryption
│   │   ├── ipc-schemas.js       # Zod validation schemas
│   │   └── engine/
│   │       ├── agent-runner.js  # LLM execution loop
│   │       ├── scheduler.js     # Cron scheduling
│   │       ├── mcp-client.js    # Model Context Protocol
│   │       ├── crew-engine.js   # Multi-agent orchestration
│   │       ├── workflow-engine.js # DAG-based workflows
│   │       ├── integration-utils.js # Rate limiter, circuit breaker
│   │       └── integrations/    # 500 integration modules
│   │           ├── registry.js  # Integration loader
│   │           ├── _template.js # Template for new integrations
│   │           ├── slack.js
│   │           ├── discord.js
│   │           └── ...
│   └── renderer/                # Frontend (React)
│       ├── src/
│       │   ├── App.jsx          # Root component + router
│       │   ├── ws-bridge.js     # WebSocket IPC bridge
│       │   ├── stores/          # Zustand stores
│       │   │   ├── agentStore.js
│       │   │   ├── runStore.js
│       │   │   ├── modelStore.js
│       │   │   └── ...
│       │   ├── views/           # Page components
│       │   │   ├── DashboardView.jsx
│       │   │   ├── AgentsView.jsx
│       │   │   ├── HistoryView.jsx
│       │   │   ├── ChatView.jsx
│       │   │   └── ...
│       │   └── components/      # Reusable components
│       └── dist/                # Built output (served by web-server)
├── tests/                       # Test suites
├── build/                       # Electron builder config
├── docs/                        # Documentation
└── package.json
```

---

## Security Model

```
┌─────────────────────────────────────────┐
│ CREDENTIALS                              │
│                                          │
│  Electron: OS Keychain (safeStorage)     │
│  Fallback: AES-256-GCM + .store-key     │
│  File permissions: 0o600 (owner only)    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ INPUT VALIDATION                         │
│                                          │
│  Zod schemas on all IPC channels         │
│  Path traversal protection (basename)    │
│  Body size limits (1 MB webhooks)        │
│  Rate limiting (60 req/min per agent)    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ RESILIENCE                               │
│                                          │
│  Circuit breaker: 5 failures → open      │
│  Error budget: 10 errors per 5 min       │
│  Rate limiter: 20 req/sec per integration│
│  Auto-restart on service crash (2s delay)│
│  DB atomic writes (temp file → rename)   │
└─────────────────────────────────────────┘
```

---

## Adding a New Integration

1. Copy `src/main/engine/integrations/_template.js`
2. Set `id`, `name`, `category`, `configFields`, `actions`
3. Implement `test()`, `connect()`, `disconnect()`, and action handlers
4. Drop the file in `integrations/` — it's auto-discovered on startup
5. Run `node tests/test-all-integrations.js` to validate the shape

---

## Adding a New IPC Channel

1. Add handler in `agent-service.js` under the message handler switch
2. Add Zod schema in `ipc-schemas.js` (if it takes user input)
3. Add to `preload.js` (for Electron)
4. Add to `ws-bridge.js` (for browser mode)
5. Add `proxy('channel-name')` in `web-server.js` `buildHandlers()`
6. Add to [API docs](api.md)
