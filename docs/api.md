# Dax API Reference

> Complete IPC channel reference for Dax v0.1.0

All communication between the renderer (UI) and the backend service flows through IPC channels. In Electron mode, these use `ipcRenderer.invoke()`. In browser/web mode, they use WebSocket messages via `ws-bridge.js`.

**WebSocket protocol:**
```
→ { type: "invoke", id: 1, channel: "agents-list", args: [] }
← { type: "response", id: 1, result: [...] }
← { type: "event", event: "run-started", data: {...} }
```

**Timeouts:** Most calls timeout at 2 minutes. Long-running operations (`agent-run`, `crews-run`, `mcp-call-tool`, `chat-message`) get 10 minutes.

**Validation:** Input validation uses Zod schemas defined in `ipc-schemas.js`. Invalid input returns `{ error: "Validation error: ..." }`.

---

## Agents

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `agents-list` | — | `Agent[]` | List all agents |
| `agents-get` | `agentId` | `Agent \| null` | Get agent by ID |
| `agents-create` | `agent: AgentCreate` | `Agent` | Create new agent |
| `agents-update` | `agentId, updates` | `Agent \| null` | Update agent fields |
| `agents-delete` | `agentId` | `{ success: true }` | Delete agent and all runs |
| `agents-toggle` | `agentId` | `Agent` | Toggle enabled/disabled |
| `agent-export` | `agentId` | `ExportBundle` | Export agent as JSON |
| `agent-import` | — | `Agent` | Import agent from file dialog (Electron only) |

### Agent object

```json
{
  "id": "uuid",
  "name": "My Agent",
  "description": "",
  "model_id": "qwen3.5:0.8b",
  "system_prompt": "You are a helpful assistant...",
  "trigger_type": "manual | schedule | webhook | file_watch",
  "trigger_config": { "cron": "*/5 * * * *" },
  "enabled": true,
  "temperature": 0.7,
  "max_retries": 3,
  "token_budget": 4096,
  "webhook_token": "abc123...",
  "created_at": "2026-04-06T01:00:00.000Z",
  "updated_at": "2026-04-06T01:00:00.000Z"
}
```

---

## Runs

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `runs-list` | `agentId?, limit?` | `Run[]` | List runs (optionally filtered) |
| `runs-get` | `runId` | `Run & { logs }` | Get run with execution logs |
| `agent-run` | `agentId, triggerData?` | `Run` | Execute agent synchronously |
| `agent-cancel-run` | `runId` | `{ cancelled }` | Cancel a running agent |
| `agent-active-runs` | — | `Run[]` | Get currently executing runs |

---

## Models

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `models-list` | — | `Model[]` | List registered models |
| `models-scan-local` | — | `LocalModel[]` | Scan models directory for .gguf files |
| `models-add` | `model` | `Model` | Register a model |
| `models-delete` | `modelId` | `{ success }` | Delete model registration |
| `models-search-hf` | `{ query?, limit? }` | `HFModel[]` | Search HuggingFace for GGUF models |
| `models-download` | `{ url, filename }` | `{ success, path }` | Download model from HuggingFace |

---

## Chat

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `chat-message` | `{ messages, model?, system? }` | `{ content, usage? }` | Send message to LLM |
| `chat-history-list` | `limit?` | `ChatMessage[]` | Get chat history |
| `chat-history-save` | `{ role, content }` | `{ id }` | Save message to history |
| `chat-history-clear` | — | `{ success }` | Clear all chat history |

---

## Settings

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `settings-get` | `key` | `any \| null` | Get single setting |
| `settings-set` | `key, value` | `{ success }` | Set single setting |
| `settings-all` | — | `Record<string, any>` | Get all settings |

**Keys:** `llm_base_url`, `llm_api_key`, `llm_model`, `llm_timeout`, `webhook_port`, `webhook_token`, `webhook_bind`, `theme`, `notifications_enabled`, `auto_start`, `minimize_to_tray`, `log_level`, `max_concurrent_runs`, `default_temperature`, `voice_enabled`, `voice_model`, `voice_language`, `kb_embedding_model`, `kb_chunk_size`, `kb_chunk_overlap`

---

## Integrations

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `integrations-list` | — | `Integration[]` | List all 500 integrations |
| `integration-connect` | `integrationId, credentials` | `{ success }` | Connect integration |
| `integration-disconnect` | `integrationId` | `{ success }` | Disconnect |
| `integration-test` | `integrationId, credentials?` | `TestResult` | Test connection |
| `integration-action` | `integrationId, actionName, params` | `any` | Execute action |
| `circuit-status` | — | `{ [id]: CircuitState }` | Circuit breaker status |
| `error-budget-status` | `integrationId?` | `BudgetStatus` | Error budget status |

---

## Webhooks

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `webhook-generate-token` | `agentId` | `{ token }` | Generate webhook token |
| `webhook-get-info` | `agentId` | `{ token, url, port }` | Get webhook URL |

**HTTP webhook endpoint:** `POST http://localhost:3700/webhook/:agentId/:token`

---

## Crews (Multi-Agent)

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `crews-list` | — | `Crew[]` | List all crews |
| `crews-get` | `crewId` | `Crew \| null` | Get crew by ID |
| `crews-create` | `crew` | `Crew` | Create crew |
| `crews-update` | `crewId, updates` | `Crew \| null` | Update crew |
| `crews-delete` | `crewId` | `{ success }` | Delete crew |
| `crews-run` | `crewId, triggerData?` | `CrewRun` | Execute crew |

---

## Knowledge Base (RAG)

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `kb-list` | — | `KB[]` | List knowledge bases |
| `kb-get` | `kbId` | `KB & { documents }` | Get KB with documents |
| `kb-create` | `{ name, description?, model? }` | `KB` | Create KB |
| `kb-delete` | `kbId` | `{ success }` | Delete KB |
| `kb-ingest` | `{ kb_id, file_path?, text? }` | `{ doc_id, chunks }` | Ingest document |
| `kb-query` | `{ kb_id, query, top_k? }` | `{ results }` | Semantic search |
| `kb-delete-doc` | `{ kb_id, doc_id }` | `{ success }` | Delete document |
| `kb-ensure-model` | `modelName` | `{ ready }` | Ensure embedding model available |
| `kb-select-file` | — | `string[]` | File picker (Electron only) |

---

## MCP (Model Context Protocol)

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `mcp-add-server` | `{ name, transport, command?, url? }` | `MCPServer` | Register MCP server |
| `mcp-remove-server` | `serverId` | `{ success }` | Unregister server |
| `mcp-list-servers` | — | `MCPServer[]` | List servers |
| `mcp-server-tools` | `serverId` | `Tool[]` | Get server tools |
| `mcp-call-tool` | `toolName, args` | `any` | Execute MCP tool |

---

## Plugins

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `plugins-list` | — | `Plugin[]` | List loaded plugins |
| `plugins-discover` | — | `Plugin[]` | Scan plugin directory |
| `plugins-load` | `pluginId` | `Plugin` | Load plugin |
| `plugins-unload` | `pluginId` | `{ success }` | Unload plugin |
| `plugins-dir` | — | `string` | Get plugins path |

---

## Output Files

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `output-files-list` | — | `FileInfo[]` | List agent output files |
| `output-files-read` | `filename` | `{ name, content, size }` | Read output file |

---

## Voice (Electron only)

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `voice-configure` | `config` | `{ success }` | Configure voice |
| `voice-get-config` | — | `VoiceConfig` | Get voice config |
| `voice-transcribe` | `audioBase64` | `{ text }` | Speech to text |
| `voice-synthesize` | `text` | `audioBase64` | Text to speech |

---

## System

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `system-info` | — | `SystemInfo` | OS, CPU, memory, paths |
| `get-models-dir` | — | `string` | Models directory path |
| `get-user-data` | — | `string` | User data directory path |
| `get-log-path` | — | `string` | Current log file path |
| `get-recent-logs` | `lines?` | `string[]` | Recent log entries |
| `scheduler-status` | — | `{ scheduled, active }` | Scheduler status |
| `tools-list` | — | `Tool[]` | All available tools |

---

## Events (Real-time)

Subscribe via `window.dax.on.eventName(callback)`.

| Event | Data | Description |
|-------|------|-------------|
| `runStarted` | `{ runId, agentId }` | Agent execution started |
| `runCompleted` | `{ runId, agentId, result, duration }` | Agent execution finished |
| `runStep` | `{ runId, stepNum, status, message }` | Agent step completed |
| `agentRunUpdate` | `{ runId, agentId, state }` | Run state changed |
| `llmToken` | `{ token }` | Streamed LLM output token |
| `llmStatus` | `{ status, model }` | LLM status changed |
| `modelLoaded` | `{ modelName, baseUrl }` | Model loaded |
| `modelLoading` | `{ modelName }` | Model loading started |
| `modelError` | `{ error, modelName }` | Model loading failed |
| `modelDownloadProgress` | `{ filename, percent, done? }` | Download progress |
| `notification` | `{ title, body, type }` | Generic notification |
| `navigate` | `{ path, state? }` | UI navigation |
| `oauthSuccess` | `{ integrationId, credentials }` | OAuth completed |
| `oauthError` | `{ integrationId, error }` | OAuth failed |

---

## Window Controls (Electron only)

| Channel | Description |
|---------|-------------|
| `win-minimize` | Minimize window |
| `win-maximize` | Maximize/restore window |
| `win-close` | Close window |
| `win-is-maximized` | Check maximized state |
| `dialog-open-folder` | Open folder picker |
| `dialog-open-file` | Open file picker |
| `shell-open-external` | Open URL in browser |
