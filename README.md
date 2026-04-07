# Dax — Privacy-first AI Agent Platform

> Build, run, and automate AI agents that never leave your machine. Local models. 500+ integrations. Zero cloud.

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-blue.svg)](https://github.com/FileShot/dax/releases)
[![Version](https://img.shields.io/badge/version-0.1.1-brightgreen.svg)](https://github.com/FileShot/dax/releases/tag/v0.1.1)

Dax is a desktop application for building and running autonomous AI agents using local language models. Agents can scrape websites, read and send email, query databases, post to Slack, watch files, call APIs, and write output — all orchestrated by an LLM running entirely on your hardware.

No API costs for inference. No data sent to the cloud. No subscription required.

---

## What it does

You describe a task in plain text. Dax creates an agent that runs on a schedule (or on demand, or via webhook), executes tools to accomplish the task, and saves the output. Examples:

- **Bitcoin Price Tracker** — fetches BTC/USD every 5 minutes, appends to a log file
- **Daily News Digest** — scrapes top headlines at 8 AM, summarizes into a Markdown file
- **GitHub Issues Monitor** — checks watched repos for new issues, posts summary to Slack
- **Email Classifier** — reads Gmail inbox every 30 minutes, sorts emails into labeled folders
- **System Health Report** — generates a weekly performance and uptime summary

---

## Features

### Core
- **Agent Builder** — describe a task in natural language; Dax configures tools, schedule, and output
- **Local LLMs** — built-in one-click model downloader (GGUF via Hugging Face), plus Ollama, LM Studio, and any OpenAI-compatible endpoint
- **Scheduling** — cron-based schedules, manual on-demand runs, HTTP webhook triggers
- **Multi-agent Crews** — sequential and hierarchical agent orchestration for complex workflows
- **Run History** — every execution logged with output, token cost, timing, and file artifacts
- **Chat Interface** — conversational control over your agents: ask what they did, request reports, trigger runs

### Integrations
- **500+ built-in integrations** — Slack, GitHub, Gmail, Notion, Google Sheets, PostgreSQL, Stripe, and more
- **MCP support** — Model Context Protocol for connecting external tool servers
- **Webhook triggers** — HTTP endpoint per agent for external systems to fire
- **OAuth** — credentials stored in OS keychain (Windows Credential Manager / macOS Keychain)

### Infrastructure
- **RAG / Knowledge Base** — ingest documents and query them from agents with local embeddings
- **Plugin system** — extend Dax with custom tools and integrations via JavaScript plugins
- **Voice input** — speech-to-text via configurable voice engine
- **Health monitoring** — circuit breakers with error budgets protect integrations from cascading failures
- **11 themes** — Dracula, Nord, Monokai, Catppuccin Mocha, GitHub Dark, and more

---

## Quick Start

**Requirements:**
- Windows 10/11 x64 (macOS and Linux builds coming)
- 4 GB RAM minimum (8 GB recommended for running LLMs)
- A local model: use the built-in downloader, or connect Ollama/LM Studio

**Install:**

Download the [latest release](https://github.com/FileShot/dax/releases/latest) and run the installer.

**Development:**

```bash
# Clone the repo
git clone https://github.com/FileShot/dax.git
cd dax

# Install dependencies
npm install
cd src/renderer && npm install && cd ../..

# Start in development mode (Electron + Vite hot reload)
npm run dev

# Build Windows installer
npm run build
```

---

## Architecture

```
dax/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── agent-service.js     # Core agent CRUD and execution coordination
│   │   ├── main.js              # Electron app entry, IPC handlers
│   │   ├── preload.js           # contextBridge -> window.dax API surface
│   │   ├── web-server.js        # Optional: WebSocket bridge for browser mode
│   │   └── engine/
│   │       ├── agent-runner.js  # Agent execution loop, tool calling
│   │       ├── workflow-engine.js # Visual workflow execution
│   │       ├── crew-engine.js   # Multi-agent crew orchestration
│   │       ├── scheduler.js     # Cron + webhook scheduler
│   │       ├── llm-client.js    # LLM provider abstraction (local + remote)
│   │       ├── mcp-client.js    # Model Context Protocol client
│   │       ├── tool-registry.js # Tool registration and dispatch
│   │       ├── tools.js         # Built-in tool implementations
│   │       ├── metrics.js       # Run metrics and cost tracking
│   │       ├── oauth-manager.js # OAuth flow and credential storage
│   │       ├── plugin-loader.js # Dynamic plugin loading
│   │       ├── voice-engine.js  # Speech-to-text integration
│   │       ├── rag/             # Retrieval-Augmented Generation
│   │       └── integrations/    # 500+ third-party integrations
│   └── renderer/                # React frontend
│       └── src/
│           ├── views/           # Page components (Dashboard, Agents, Chat, etc.)
│           ├── components/      # Shared UI components
│           ├── stores/          # Zustand state management
│           └── ws-bridge.js     # WebSocket bridge (browser/web mode)
├── docs/                        # Extended documentation
└── tests/                       # Integration and unit tests
```

**Tech stack:**
- Electron 33 + Node.js
- React 18 + Vite + Tailwind CSS + Zustand
- SQLite (better-sqlite3) for agent storage and run history
- GGUF inference via llama.cpp bindings

---

## Documentation

- [Architecture](docs/architecture.md) — System design, data flow, extending Dax
- [API Reference](docs/api.md) — Complete IPC channel and WebSocket event reference
- [Deployment Guide](docs/deployment.md) — Web server mode, reverse proxy, backups
- [Troubleshooting](docs/troubleshooting.md) — Common issues and diagnostics

---

## Contributing

Issues and pull requests welcome. For large changes, open an issue first to discuss the approach.

```bash
# Run tests
npm test
```

---

## License

[MIT License](LICENSE) — free and open source.

Copyright (c) 2026 Graysoft