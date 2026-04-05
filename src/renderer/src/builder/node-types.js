// ─── Node Type Definitions ──────────────────────────────────
// Each node type has: id, label, category, color, icon, inputs, outputs, config schema

export const NODE_CATEGORIES = {
  trigger:   { label: 'Triggers',   color: 'dax-node-trigger',   desc: 'Start a workflow' },
  processor: { label: 'Processors', color: 'dax-node-processor', desc: 'Process data with AI' },
  action:    { label: 'Actions',    color: 'dax-node-action',    desc: 'Do something' },
  logic:     { label: 'Logic',      color: 'dax-node-logic',     desc: 'Control flow' },
};

export const NODE_TYPES = {
  // ─── Triggers ─────────────────────────────────────────
  manual_trigger: {
    id: 'manual_trigger',
    label: 'Manual Trigger',
    category: 'trigger',
    icon: 'Play',
    description: 'Start workflow manually or via API',
    inputs: [],
    outputs: [{ id: 'out', label: 'Output' }],
    defaults: { prompt: '' },
    configFields: [
      { key: 'prompt', label: 'Input Prompt', type: 'textarea', placeholder: 'Enter trigger message...' },
    ],
  },
  schedule_trigger: {
    id: 'schedule_trigger',
    label: 'Schedule',
    category: 'trigger',
    icon: 'Clock',
    description: 'Run on a cron schedule',
    inputs: [],
    outputs: [{ id: 'out', label: 'Output' }],
    defaults: { cron: '0 9 * * *' },
    configFields: [
      { key: 'cron', label: 'Cron Expression', type: 'text', placeholder: '0 9 * * *' },
    ],
  },
  webhook_trigger: {
    id: 'webhook_trigger',
    label: 'Webhook',
    category: 'trigger',
    icon: 'Globe',
    description: 'Triggered by an HTTP request',
    inputs: [],
    outputs: [{ id: 'out', label: 'Body' }],
    defaults: { method: 'POST', path: '/webhook' },
    configFields: [
      { key: 'path', label: 'Endpoint Path', type: 'text', placeholder: '/webhook' },
      { key: 'method', label: 'HTTP Method', type: 'select', options: ['GET', 'POST', 'PUT'] },
    ],
  },
  file_watch_trigger: {
    id: 'file_watch_trigger',
    label: 'File Watch',
    category: 'trigger',
    icon: 'Eye',
    description: 'Triggered when a file changes',
    inputs: [],
    outputs: [{ id: 'out', label: 'File Event' }],
    defaults: { path: '', events: ['change'] },
    configFields: [
      { key: 'path', label: 'Watch Path', type: 'text', placeholder: 'C:/Users/me/watched-folder' },
    ],
  },

  // ─── Processors ───────────────────────────────────────
  ai_analyze: {
    id: 'ai_analyze',
    label: 'AI Analyze',
    category: 'processor',
    icon: 'Brain',
    description: 'Analyze input using AI',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Analysis' }],
    defaults: { prompt: 'Analyze the following:', temperature: 0.7 },
    configFields: [
      { key: 'prompt', label: 'System Prompt', type: 'textarea', placeholder: 'Analyze the following:' },
      { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, step: 0.1 },
    ],
  },
  ai_extract: {
    id: 'ai_extract',
    label: 'Extract Data',
    category: 'processor',
    icon: 'FileSearch',
    description: 'Extract structured data from text',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Extracted' }],
    defaults: { fields: '', format: 'json' },
    configFields: [
      { key: 'fields', label: 'Fields to Extract', type: 'textarea', placeholder: 'name, email, phone' },
      { key: 'format', label: 'Output Format', type: 'select', options: ['json', 'csv', 'text'] },
    ],
  },
  ai_summarize: {
    id: 'ai_summarize',
    label: 'Summarize',
    category: 'processor',
    icon: 'AlignLeft',
    description: 'Summarize text content',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Summary' }],
    defaults: { maxLength: 200, style: 'concise' },
    configFields: [
      { key: 'maxLength', label: 'Max Length (words)', type: 'number', min: 10, max: 2000 },
      { key: 'style', label: 'Style', type: 'select', options: ['concise', 'detailed', 'bullet_points'] },
    ],
  },
  ai_classify: {
    id: 'ai_classify',
    label: 'Classify',
    category: 'processor',
    icon: 'Tags',
    description: 'Classify input into categories',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Classification' }],
    defaults: { categories: '', multiLabel: false },
    configFields: [
      { key: 'categories', label: 'Categories', type: 'textarea', placeholder: 'positive, negative, neutral' },
      { key: 'multiLabel', label: 'Allow Multiple Labels', type: 'boolean' },
    ],
  },
  ai_generate: {
    id: 'ai_generate',
    label: 'Generate',
    category: 'processor',
    icon: 'Sparkles',
    description: 'Generate text using AI',
    inputs: [{ id: 'in', label: 'Context' }],
    outputs: [{ id: 'out', label: 'Generated' }],
    defaults: { prompt: '', temperature: 0.7, maxTokens: 1024 },
    configFields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', placeholder: 'Generate a response based on:' },
      { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, step: 0.1 },
      { key: 'maxTokens', label: 'Max Tokens', type: 'number', min: 1, max: 8192 },
    ],
  },
  transform: {
    id: 'transform',
    label: 'Transform',
    category: 'processor',
    icon: 'Shuffle',
    description: 'Transform data with JavaScript',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    defaults: { code: 'return input;' },
    configFields: [
      { key: 'code', label: 'Transform Code (JS)', type: 'code', placeholder: 'return input.toUpperCase();' },
    ],
  },

  // ─── Actions ──────────────────────────────────────────
  http_request: {
    id: 'http_request',
    label: 'HTTP Request',
    category: 'action',
    icon: 'Globe',
    description: 'Make an HTTP request',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Response' }],
    defaults: { url: '', method: 'GET', headers: '{}', body: '' },
    configFields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/data' },
      { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'headers', label: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer ..."}' },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: '{"key": "value"}' },
    ],
  },
  write_file: {
    id: 'write_file',
    label: 'Write File',
    category: 'action',
    icon: 'FileOutput',
    description: 'Write data to a file',
    inputs: [{ id: 'in', label: 'Content' }],
    outputs: [{ id: 'out', label: 'Result' }],
    defaults: { path: '', append: false },
    configFields: [
      { key: 'path', label: 'File Path', type: 'text', placeholder: 'C:/output/result.txt' },
      { key: 'append', label: 'Append Mode', type: 'boolean' },
    ],
  },
  exec_command: {
    id: 'exec_command',
    label: 'Run Command',
    category: 'action',
    icon: 'Terminal',
    description: 'Execute a shell command',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    defaults: { command: '', cwd: '' },
    configFields: [
      { key: 'command', label: 'Command', type: 'text', placeholder: 'echo "Hello"' },
      { key: 'cwd', label: 'Working Directory', type: 'text', placeholder: 'C:/project' },
    ],
  },
  notification: {
    id: 'notification',
    label: 'Notification',
    category: 'action',
    icon: 'Bell',
    description: 'Show a desktop notification',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Done' }],
    defaults: { title: '', body: '' },
    configFields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Agent Complete' },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'The task finished successfully.' },
    ],
  },
  log_output: {
    id: 'log_output',
    label: 'Log',
    category: 'action',
    icon: 'FileText',
    description: 'Log data to run history',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [],
    defaults: { level: 'info', label: '' },
    configFields: [
      { key: 'level', label: 'Level', type: 'select', options: ['info', 'warn', 'error'] },
      { key: 'label', label: 'Label', type: 'text', placeholder: 'Step completed' },
    ],
  },

  // ─── Logic ────────────────────────────────────────────
  if_else: {
    id: 'if_else',
    label: 'If / Else',
    category: 'logic',
    icon: 'GitFork',
    description: 'Branch based on a condition',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [
      { id: 'true', label: 'True' },
      { id: 'false', label: 'False' },
    ],
    defaults: { condition: '', operator: 'equals', value: '' },
    configFields: [
      { key: 'condition', label: 'Field/Expression', type: 'text', placeholder: 'data.status' },
      { key: 'operator', label: 'Operator', type: 'select', options: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'] },
      { key: 'value', label: 'Compare Value', type: 'text', placeholder: 'success' },
    ],
  },
  loop: {
    id: 'loop',
    label: 'Loop',
    category: 'logic',
    icon: 'Repeat',
    description: 'Iterate over a list',
    inputs: [{ id: 'in', label: 'List' }],
    outputs: [{ id: 'item', label: 'Item' }, { id: 'done', label: 'Done' }],
    defaults: { maxIterations: 100 },
    configFields: [
      { key: 'maxIterations', label: 'Max Iterations', type: 'number', min: 1, max: 10000 },
    ],
  },
  delay: {
    id: 'delay',
    label: 'Delay',
    category: 'logic',
    icon: 'Timer',
    description: 'Wait before continuing',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    defaults: { seconds: 5 },
    configFields: [
      { key: 'seconds', label: 'Delay (seconds)', type: 'number', min: 0, max: 3600 },
    ],
  },
  filter: {
    id: 'filter',
    label: 'Filter',
    category: 'logic',
    icon: 'Filter',
    description: 'Filter items in a list',
    inputs: [{ id: 'in', label: 'List' }],
    outputs: [{ id: 'pass', label: 'Passed' }, { id: 'fail', label: 'Failed' }],
    defaults: { field: '', operator: 'equals', value: '' },
    configFields: [
      { key: 'field', label: 'Field', type: 'text', placeholder: 'item.status' },
      { key: 'operator', label: 'Operator', type: 'select', options: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than'] },
      { key: 'value', label: 'Value', type: 'text' },
    ],
  },
  merge: {
    id: 'merge',
    label: 'Merge',
    category: 'logic',
    icon: 'Merge',
    description: 'Combine multiple inputs',
    inputs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    outputs: [{ id: 'out', label: 'Merged' }],
    defaults: { mode: 'combine' },
    configFields: [
      { key: 'mode', label: 'Merge Mode', type: 'select', options: ['combine', 'append', 'zip'] },
    ],
  },
};

// Get node types grouped by category
export function getNodesByCategory() {
  const groups = {};
  for (const [id, node] of Object.entries(NODE_TYPES)) {
    const cat = node.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(node);
  }
  return groups;
}

// Get Lucide icon name for a node
export function getNodeIcon(nodeTypeId) {
  return NODE_TYPES[nodeTypeId]?.icon || 'Box';
}
