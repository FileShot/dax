// Disable sys-monitor and web-checker via WS invoke
const WebSocket = require('ws');

const SYS_MONITOR_ID = '49d5fd93-0800-4b1f-8588-b143bfea334e';
const WEB_CHECKER_ID = '990bc47b-d409-436d-8f11-ebc8a7ef66eb';

const ws = new WebSocket('ws://localhost:3800/ws');
let pending = 0;

function invoke(channel, ...args) {
  const id = Math.random().toString(36).slice(2);
  pending++;
  return new Promise((resolve, reject) => {
    function onMsg(raw) {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'invoke-result' && msg.id === id) {
        ws.off('message', onMsg);
        pending--;
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      }
    }
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ type: 'invoke', id, channel, args }));
  });
}

ws.on('open', async () => {
  console.log('Connected');
  try {
    // First list all agents
    const agents = await invoke('agents-list');
    console.log('Agents:', JSON.stringify(agents.map(a => ({ id: a.id, name: a.name, enabled: a.enabled }))));

    // Disable the ones that are enabled
    for (const id of [SYS_MONITOR_ID, WEB_CHECKER_ID]) {
      const agent = agents.find(a => a.id === id);
      if (agent && agent.enabled) {
        console.log(`Disabling ${agent.name}...`);
        const result = await invoke('agents-toggle', id);
        console.log(`${agent.name} enabled=${result.enabled}`);
      } else if (agent) {
        console.log(`${agent.name} already disabled`);
      } else {
        console.log(`Agent ${id} not found`);
      }
    }
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    ws.close();
  }
});

ws.on('error', (e) => console.error('WS error:', e.message));

