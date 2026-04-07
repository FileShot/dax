# Changelog

All notable changes to Dax are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.1.1] — 2025-04-07

### Fixed
- Release workflow path resolution (`dax/` prefix) so GitHub Actions correctly finds build artifacts
- Windows installer now published as `Dax-Setup-0.1.1.exe` under the correct release tag

### Changed
- Bumped version to 0.1.1 in `package.json`

---

## [0.1.0] — 2025-04-06

### Initial Release

First public release of Dax. Core platform is functional and stable for Windows.

#### Agent System
- Agent CRUD — create, edit, enable/disable, delete agents
- Trigger types: manual, cron schedule, HTTP webhook, file watch, event
- Per-agent system prompt, model selection, and tool configuration
- Agent export/import (JSON)

#### Execution Engine
- Agent runner with multi-step tool-calling loop
- Workflow engine for visual node-based agent composition
- Multi-agent crew orchestration (sequential and hierarchical)
- Cron scheduler with next-run display
- Webhook server with per-agent token auth
- Run cancellation

#### LLMs & Models
- Built-in model downloader — browse and install GGUF models from Hugging Face
- Local scan for existing `.gguf` files
- Ollama, LM Studio, and any OpenAI-compatible endpoint support
- Model context length and quantization display
- Tool-calling verification per model

#### Integrations
- 500+ built-in integrations across communication, productivity, database, and cloud categories
- OAuth credential flow with OS keychain storage (Windows Credential Manager)
- Circuit breaker pattern with configurable error budgets per integration
- MCP (Model Context Protocol) client — connect external tool servers

#### Knowledge Base (RAG)
- Document ingestion (PDF, text, Markdown, CSV)
- Local vector embeddings
- Query from agents via `kb_query` tool

#### Chat Interface
- Conversational control over the agent stack
- Full chat history with persistent storage
- Markdown rendering with inline code, lists, and headers
- Suggested prompts for common queries

#### Run History
- Complete run log sorted by recency
- Per-run output viewer with Markdown rendering
- Status filtering (completed, error, running, pending)
- Token cost and execution time per run
- Run timeline visualization

#### UI / UX
- 11 built-in themes: Monolith, Dark Default, Monokai, Dracula, Nord, Solarized Dark, GitHub Dark, Void, Carbon, Light, Catppuccin Mocha
- Sidebar navigation with collapse
- Real-time status bar (active agents, memory usage)
- TitleBar with window controls (frameless window)
- Live activity panel on Dashboard
- Sparkline charts per agent on Dashboard

#### Infrastructure
- SQLite database (better-sqlite3) for agents, runs, models, chat history
- Plugin system for third-party tool/integration extensions
- Voice input (speech-to-text via configurable engine)
- Settings persistence
- Metrics endpoint → Dashboard service metrics panel
- Web server mode with WebSocket bridge (run Dax UI in a browser against a remote backend)

#### Distribution
- Windows x64 NSIS installer built via GitHub Actions
- Electron 33 + Node.js 20

---

[0.1.1]: https://github.com/FileShot/dax/releases/tag/v0.1.1
[0.1.0]: https://github.com/FileShot/dax/releases/tag/v0.1.0
