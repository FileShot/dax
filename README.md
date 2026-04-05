# Dax — Privacy-first AI Agent Platform

Build, deploy, and manage autonomous AI agents entirely on your machine. No cloud required. No data leaves your device.

## Features

- **500+ integrations** — Slack, GitHub, Stripe, Google Sheets, and more
- **Local LLM support** — Works with Ollama, LM Studio, any OpenAI-compatible endpoint
- **Scheduled agents** — Cron-based automation and file watchers
- **Multi-agent crews** — Sequential and hierarchical agent orchestration
- **RAG / Knowledge Base** — Document ingestion with local embeddings
- **MCP support** — Model Context Protocol for external tool servers
- **Plugin system** — Extend Dax with custom tools and integrations
- **Webhook triggers** — Trigger agents via HTTP webhooks

## Quick Start

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Build installer
npm run build
```

## Architecture

- `src/main/` — Electron main process, IPC bridge, agent service
- `src/main/engine/` — Agent runner, workflow engine, scheduler, LLM client
- `src/main/engine/integrations/` — 500+ third-party API integrations
- `src/renderer/` — React UI (Vite + Tailwind + Zustand)

## License

[Business Source License 1.1](LICENSE) — converts to Apache 2.0 on April 5, 2030.

Free for personal use, internal tooling, and non-competing commercial use.
Contact [graysoft.dev](https://graysoft.dev) for commercial licensing.
