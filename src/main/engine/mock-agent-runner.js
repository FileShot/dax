
  module.exports = {
    executeAgent: async (agent, triggerData) => {
      global.__daxTestExecuteCount = (global.__daxTestExecuteCount || 0) + 1;
      global.__daxTestLastArgs = { agent, triggerData };
      return { id: 'test-run-id', status: 'completed' };
    },
    cancelRun: () => {},
    getActiveRuns: () => [],
    events: { on: () => {} },
    toolRegistry: { registerTool: () => {} },
  };
