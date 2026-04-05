# Dax Agent Testing Rules

## Test Method
- Dax has a **web server mode** at `http://localhost:3800` that serves the same React UI and connects to the real agent-service backend via WebSocket.
- All agent testing is done through the browser UI unless the browser path is blocked.
- If the browser path is blocked, state the blocker before falling back to backend-only.
- State the exact model used for every test run.

## Model Rules
- Default test model: **Qwen3.5-0.8B** (Q8_0 quantization preferred, Q4_K_M acceptable)
- Model files live in `D:\models\qwen3.5\Qwen3.5-0.8B-GGUF\`
- Verify the model is loaded and selected in the UI before any test run.
- Do not substitute a different model without stating the change.

## Test Scenarios — Real-World Agent Use Cases
Each test scenario exercises a different combination of tools, triggers, and complexity.

### Category 1: Continuous Monitoring (runs all day)
1. **System health monitor** — cron every 2 min, checks disk/memory/CPU via `system_info`, writes timestamped report via `write_file`
2. **Endpoint health check** — cron every 5 min, pings multiple HTTP endpoints via `http_request`, writes status dashboard HTML via `write_file`
3. **Log analyzer** — cron every 10 min, reads a growing log file via `read_file`, summarizes errors/anomalies, appends findings via `write_file`

### Category 2: Web Scraping & Data Collection
4. **News headline aggregator** — cron every 30 min, scrapes 3+ public news sites via `web_scraper`, compiles digest via `write_file`
5. **Price tracker** — cron every 15 min, scrapes a public product page, extracts price, appends to CSV log
6. **Public API data collector** — cron every 10 min, calls a free public API (weather, crypto prices, etc.) via `http_request`, parses JSON via `json_parse`, logs data

### Category 3: Event-Driven Automation
7. **File watcher summarizer** — watches a folder, when a new file appears, reads it via `read_file`, writes a summary via `write_file`
8. **Webhook report generator** — receives POST via webhook, processes payload, writes structured report
9. **Directory organizer** — manual trigger, scans a folder via `list_directory`, reads file contents via `read_file`, proposes organization

### Category 4: Multi-Tool Complex Tasks
10. **Research assistant** — scrapes a topic from 3+ sources, cross-references data, writes a structured markdown report
11. **System audit agent** — combines `system_info` + `list_directory` + `read_file` + `execute_command` to produce a comprehensive system audit report
12. **Competitive intelligence scraper** — scrapes multiple competitor pages, extracts key data, writes comparison report

### Category 5: Multi-Agent / Stress
13. **Run 3+ agents simultaneously** — system monitor + web scraper + file watcher all active at once
14. **High-frequency agent** — cron every 1 min, exercises tool calling under rapid scheduling
15. **Long-running complex agent** — single agent that chains 5+ tool calls in sequence, exercises the full iteration loop

## Execution Rules
1. Create agents through the browser UI, not by seeding the database.
2. Verify each agent's configuration in the UI before enabling it.
3. For scheduled agents: let them run for at least 3 complete cron cycles before evaluating.
4. For manual agents: run at least 3 times, checking output each time.
5. For file-watch agents: trigger at least 3 file events, checking output each time.
6. For webhook agents: send at least 3 POST requests with different payloads.
7. For multi-agent tests: all agents must be running concurrently for at least 10 minutes.

## Success Criteria
- Agent executes without errors in the run log.
- Tool calls are made correctly (right tool, right arguments).
- Output files are created/appended as expected.
- Scheduled agents fire on time and do not overlap (overlap guard works).
- Multiple concurrent agents do not interfere with each other.
- The model produces coherent, useful output (not garbage or empty responses).
- The agent can run indefinitely without memory leaks or crashes.

## Failure Criteria
- Agent errors out on any run.
- Tool calls fail or are malformed.
- Output files are empty, corrupted, or missing.
- Scheduled agent misses a trigger or fires twice.
- Model produces empty response, hallucinated tool names, or incoherent output.
- Service crashes or becomes unresponsive.
- DB persistence fails silently.

## Monitoring During Tests
- Check service logs in `%APPDATA%\dax\logs\` after each test cycle.
- Check the runs list in the UI to verify run status (completed/error).
- Check output files on disk to verify tool execution.
- For long-running tests, check memory usage of the node process periodically.

## Reporting
- Facts only, defects only.
- No positive adjectives, no cheerleading, no celebrating.
- State the exact model, exact scenario, exact error message.
- Include the run ID and timestamps for every reported issue.

## Banned
- Blaming model size for failures.
- Declaring success without evidence.
- Ending test observation early.
- Substituting backend-only runs for browser UI testing.
- Using a model other than the specified test model without stating the change.
