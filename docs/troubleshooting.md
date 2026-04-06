# Dax Troubleshooting Guide

## Common Issues

### Agent won't run / stays in "pending"

**Symptoms:** Agent shows PENDING in History, never starts.

**Causes & fixes:**
1. **No model selected** — Go to Agents → Edit → set a model
2. **Ollama not running** — Start Ollama: `ollama serve`
3. **Model not pulled** — `ollama pull qwen3.5:0.8b` (or whichever model)
4. **Agent disabled** — Check the toggle on the Agents page
5. **Prior run still active** — Scheduler skips agents that are already running. Check History for stuck RUNNING entries and cancel them.

### "LLM request timed out"

**Symptoms:** Run completes with error, logs show timeout.

**Causes:**
- Ollama is overloaded (too many concurrent agents)
- Model is too large for available RAM
- Default timeout is 2 minutes for most calls, 10 minutes for agent runs

**Fixes:**
- Reduce concurrent scheduled agents
- Use a smaller model (qwen3.5:0.8b vs 2b)
- Increase timeout in Settings → `llm_timeout`

### Service crashes and restarts in a loop

**Symptoms:** Logs show repeated "Uncaught exception" or "Service exited" messages.

**Check:**
1. View logs: Settings → "View Logs" button, or:
   ```
   # Windows
   type %APPDATA%\dax\logs\dax-service-*.log | findstr ERROR

   # Linux/Mac
   grep ERROR ~/.config/dax/logs/dax-service-*.log
   ```
2. Common crash causes:
   - Corrupted database → restore from `backups/` folder
   - Out of memory → reduce `max_concurrent_runs` in Settings
   - Port conflict → change webhook port in Settings

### Database corruption

**Symptoms:** Agent data missing, settings reset, or startup errors mentioning SQLite.

**Recovery:**
1. Stop Dax
2. Find backups:
   ```
   dir %APPDATA%\dax\backups\
   ```
3. Pick the most recent valid backup:
   ```
   copy %APPDATA%\dax\backups\dax-2026-04-06T01-00-00-000Z.db %APPDATA%\dax\dax.db
   ```
4. Restart Dax

### WebSocket disconnection in browser mode

**Symptoms:** UI shows "Disconnected" or stops updating.

**Causes:**
- Server was restarted
- Network interruption
- Browser tab was backgrounded for too long

**Fix:** The UI auto-reconnects with exponential backoff (2s → 4s → 8s → ...). If it doesn't reconnect within 30s, refresh the page.

### Integration won't connect

**Symptoms:** Integration shows "Connection failed" or error in test.

**Debugging:**
1. Click "Test" on the integration to see the specific error
2. Check credentials are correct
3. Check circuit breaker status: if an integration failed 5 times consecutively, it enters "open" state and won't retry for 60s
4. Check error budget: if an integration exceeded 10 errors in 5 minutes, it's rate-limited

### Webhook not triggering agent

**Symptoms:** POST to webhook URL returns 200 but agent doesn't run.

**Checklist:**
1. Agent must have `trigger_type: "webhook"` (not "manual")
2. Agent must be `enabled: true`
3. Webhook token must match exactly
4. Check rate limiting: 60 requests per minute per agent
5. Health check: `curl http://localhost:3700/health`
6. Watch server logs for webhook receipt

### Chat doesn't know about agents

**Symptoms:** Chat responds generically, doesn't mention your agents.

**Cause:** The Chat system prompt is built when you send a message. It includes recent run data and scheduler status.

**Fix:** Make sure agents have run recently. The Chat pulls the last 10 runs. If no agents have run, it has no data to reference.

### Model download stuck

**Symptoms:** Progress bar stops or shows no progress.

**Causes:**
- Network issue
- HuggingFace rate limiting
- File is very large

**Fix:** Cancel and retry. Downloads go to `%APPDATA%\dax\models\`. Partial downloads can be safely deleted.

---

## Diagnostic Commands

### Check Ollama status
```bash
curl http://localhost:11434/api/tags
```

### Check Dax web server
```bash
curl http://localhost:3800/health
```

### Check webhook server
```bash
curl http://localhost:3700/health
```

### View recent logs
```bash
# Windows
type %APPDATA%\dax\logs\dax-service-2026-04-06.log | Select-String -Pattern ERROR

# Linux
tail -100 ~/.config/dax/logs/dax-service-$(date +%F).log
```

### Check database size
```bash
# Windows
dir %APPDATA%\dax\dax.db

# Linux
ls -lh ~/.config/dax/dax.db
```

### List backups
```bash
# Windows
dir %APPDATA%\dax\backups\

# Linux
ls -lt ~/.config/dax/backups/
```

---

## Log Levels

Logs use structured format: `[timestamp] [LEVEL] [CATEGORY] message | {data}`

| Level | When |
|-------|------|
| `INFO` | Normal operations (agent started, tool executed, DB saved) |
| `WARN` | Non-critical issues (skipped cron trigger, rate limit hit) |
| `ERROR` | Failures (LLM timeout, integration error, crash) |

**Categories:** `SERVICE`, `DB`, `RUNNER`, `SCHEDULER`, `MCP`, `WEBHOOK`, `INTEGRATION`

---

## Getting Help

1. Check this guide first
2. Review logs in `%APPDATA%\dax\logs\`
3. File an issue at https://github.com/FileShot/dax/issues with:
   - Dax version (shown in Settings)
   - OS and Node.js version
   - Relevant log excerpts (redact any API keys)
   - Steps to reproduce
