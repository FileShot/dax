'use strict';
/**
 * IPC Input Schemas
 * Zod schemas for all IPC channels that accept user-controlled input.
 * Read-only / zero-arg channels (list, get by id, etc.) are not included.
 * 
 * Usage in main.js: ipcSafe('channel', handler, schemas.channelName)
 */
const { z } = require('zod');

// ─── Primitives ────────────────────────────────────────────

const id = z.string().min(1).max(128);
const shortStr = z.string().max(512);
const longStr = z.string().max(100_000);
const url = z.string().url().max(2048);
const cronExpr = z.string().max(128).optional();

// ─── Agents ────────────────────────────────────────────────

exports.agentsCreate = z.object({
  name: z.string().min(1).max(200),
  model: z.string().min(1).max(200),
  system_prompt: longStr.optional().default(''),
  description: shortStr.optional().default(''),
  trigger_type: z.enum(['manual', 'schedule', 'webhook', 'file_watch']).optional().default('manual'),
  trigger_config: z.record(z.unknown()).optional().default({}),
  tool_ids: z.array(z.string().max(128)).max(50).optional().default([]),
  integration_ids: z.array(z.string().max(128)).max(100).optional().default([]),
  mcp_server_ids: z.array(z.string().max(128)).max(20).optional().default([]),
  crew_role: shortStr.optional(),
  max_iterations: z.number().int().min(1).max(100).optional().default(10),
  temperature: z.number().min(0).max(2).optional(),
  timeout_seconds: z.number().int().min(10).max(3600).optional(),
  enabled: z.boolean().optional().default(true),
});

exports.agentsUpdate = z.object({
  name: z.string().min(1).max(200).optional(),
  model: z.string().min(1).max(200).optional(),
  system_prompt: longStr.optional(),
  description: shortStr.optional(),
  trigger_type: z.enum(['manual', 'schedule', 'webhook', 'file_watch']).optional(),
  trigger_config: z.record(z.unknown()).optional(),
  tool_ids: z.array(z.string().max(128)).max(50).optional(),
  integration_ids: z.array(z.string().max(128)).max(100).optional(),
  mcp_server_ids: z.array(z.string().max(128)).max(20).optional(),
  crew_role: shortStr.optional(),
  max_iterations: z.number().int().min(1).max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  timeout_seconds: z.number().int().min(10).max(3600).optional(),
  enabled: z.boolean().optional(),
}).strict();

// ─── Agent Run ─────────────────────────────────────────────

exports.agentRun = z.tuple([
  id,  // agentId
  z.record(z.unknown()).optional(),  // triggerData — arbitrary, validated downstream
]);

// ─── Models ────────────────────────────────────────────────

exports.modelsAdd = z.object({
  name: z.string().min(1).max(200),
  provider: z.enum(['ollama', 'lmstudio', 'openai', 'anthropic', 'custom']),
  base_url: url.optional(),
  api_key: z.string().max(512).optional(),
  context_length: z.number().int().min(512).max(2_000_000).optional(),
});

// ─── Settings ──────────────────────────────────────────────

const ALLOWED_SETTINGS_KEYS = new Set([
  'llm_base_url', 'llm_api_key', 'llm_model', 'llm_timeout',
  'webhook_port', 'webhook_token',
  'theme', 'notifications_enabled', 'auto_start', 'minimize_to_tray',
  'log_level', 'max_concurrent_runs', 'default_temperature',
  'voice_enabled', 'voice_model', 'voice_language',
  'kb_embedding_model', 'kb_chunk_size', 'kb_chunk_overlap',
]);

exports.settingsSet = z.tuple([
  z.string().refine(k => ALLOWED_SETTINGS_KEYS.has(k), {
    message: 'Unknown settings key',
  }),
  z.unknown(),  // value validated per-key in agent-service
]);

// ─── MCP ───────────────────────────────────────────────────

exports.mcpAddServer = z.object({
  name: z.string().min(1).max(200),
  transport: z.enum(['stdio', 'sse']),
  command: z.string().max(1000).optional(),
  args: z.array(z.string().max(500)).max(50).optional(),
  url: url.optional(),
  env: z.record(z.string().max(1000)).optional(),
}).refine(s => s.transport === 'stdio' ? !!s.command : !!s.url, {
  message: 'stdio transport requires command, sse transport requires url',
});

exports.mcpCallTool = z.tuple([
  z.string().min(1).max(200),  // toolName
  z.record(z.unknown()),       // args
]);

// ─── Integrations ──────────────────────────────────────────

exports.integrationConnect = z.tuple([
  id,                          // integrationId
  z.record(z.unknown()),       // credentials — structure varies per integration
]);

exports.integrationAction = z.tuple([
  id,                          // integrationId
  z.string().min(1).max(200),  // actionName
  z.record(z.unknown()),       // params
]);

// ─── Crews ─────────────────────────────────────────────────

exports.crewsCreate = z.object({
  name: z.string().min(1).max(200),
  description: shortStr.optional().default(''),
  agents: z.array(z.object({
    agent_id: id,
    role: shortStr.optional(),
    order: z.number().int().min(0).max(99).optional(),
  })).min(1).max(20),
  mode: z.enum(['sequential', 'hierarchical']).optional().default('sequential'),
  enabled: z.boolean().optional().default(true),
});

exports.crewsUpdate = z.object({
  name: z.string().min(1).max(200).optional(),
  description: shortStr.optional(),
  agents: z.array(z.object({
    agent_id: id,
    role: shortStr.optional(),
    order: z.number().int().min(0).max(99).optional(),
  })).min(1).max(20).optional(),
  mode: z.enum(['sequential', 'hierarchical']).optional(),
  enabled: z.boolean().optional(),
}).strict();

exports.crewsRun = z.tuple([
  id,  // crewId
  z.record(z.unknown()).optional(),  // triggerData
]);

// ─── Voice ─────────────────────────────────────────────────

exports.voiceConfigure = z.object({
  stt_model: z.string().max(200).optional(),
  tts_model: z.string().max(200).optional(),
  language: z.string().max(10).optional(),
  device: z.string().max(200).optional(),
}).strict();

// 10 MB base64 limit (7.5 MB raw audio)
const MAX_AUDIO_B64 = 10 * 1024 * 1024;
exports.voiceTranscribe = z.string()
  .max(MAX_AUDIO_B64, 'Audio payload too large (max 10 MB base64)')
  .refine(s => /^[A-Za-z0-9+/=]+$/.test(s), 'Invalid base64 encoding');

// ─── Knowledge Base ────────────────────────────────────────

exports.kbCreate = z.object({
  name: z.string().min(1).max(200),
  description: shortStr.optional().default(''),
  embedding_model: z.string().max(200).optional(),
});

exports.kbIngest = z.object({
  kb_id: id,
  file_path: z.string().max(4096),
  chunk_size: z.number().int().min(100).max(10_000).optional(),
  chunk_overlap: z.number().int().min(0).max(1000).optional(),
});

exports.kbQuery = z.object({
  kb_id: id,
  query: z.string().min(1).max(2000),
  top_k: z.number().int().min(1).max(50).optional().default(5),
});

exports.kbDeleteDoc = z.object({
  kb_id: id,
  doc_id: id,
});

exports.kbEnsureModel = z.string().min(1).max(200);

// ─── OAuth ─────────────────────────────────────────────────

exports.oauthStart = z.object({
  providerId: z.string().min(1).max(100),
  integrationId: id,
  clientId: z.string().min(1).max(500),
  clientSecret: z.string().max(500).optional(),
  options: z.record(z.unknown()).optional(),
});

// ─── Logs ──────────────────────────────────────────────────

exports.getRecentLogs = z.number().int().min(1).max(10_000).optional().default(100);

// ─── Agent Import ──────────────────────────────────────────

exports.agentImportData = z.object({
  type: z.literal('dax-agent'),
  version: z.string().max(20).optional(),
  agent: z.object({
    name: z.string().min(1).max(200),
    model: z.string().min(1).max(200),
    system_prompt: longStr.optional(),
    description: shortStr.optional(),
    trigger_type: z.string().max(50).optional(),
    trigger_config: z.record(z.unknown()).optional(),
    tool_ids: z.array(z.string().max(128)).max(50).optional(),
    integration_ids: z.array(z.string().max(128)).max(100).optional(),
  }),
});

// ─── Chat ──────────────────────────────────────────────────

exports.chatMessage = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(50_000),
  })).min(1).max(200),
  model: z.string().max(200).optional(),
  system: z.string().max(20_000).optional(),
});
