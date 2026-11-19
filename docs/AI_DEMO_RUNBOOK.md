# AI assistant demo runbook

This runbook covers the **local, seeded** MediFlow demo on Windows with the
bundled PostgreSQL server and a local Ollama model. It does not create data or
change business logic. The assistant answers only from verified results produced
by the nine read-only tools.

## 1. Preconditions

From the repository root (`C:\Users\admin\Pharma_Order_Management_App`):

```bash
ollama --version
ollama list
```

Expected installed models on this host include `qwen3-coder:latest`,
`qwen3:4b` and `llava:latest`. Only the tool-capable models are suitable for the
assistant; `llava:latest` has no advertised `tools` capability.

Check the API/database health after starting the backend:

```bash
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/health/ready
```

The backend loads `backend/.env` automatically. That file is git-ignored and must
never be committed or pasted into a ticket. For a local Ollama demo it contains
`LLM_PROVIDER=ollama`, a model name, `LLM_BASE_URL=http://127.0.0.1:11434`, and a
provider timeout bounded below the browser's 330-second chat ceiling. The checked-in
`.env.example` uses the original 30-second default; the local demo uses a higher
value because the 30.5B model is CPU-bound.

## 2. One-time setup

```bash
cd C:\Users\admin\Pharma_Order_Management_App
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt

cd backend
.venv\Scripts\python.exe -m flask --app run.py db upgrade
.venv\Scripts\python.exe -m flask --app run.py seed
```

The seed command is development/demo only. It creates the demo accounts below:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@mediflow.demo` | `admin123` |
| Distributor | `distributor@mediflow.demo` | `distributor123` |
| Retailer | `retailer@mediflow.demo` | `retailer123` |

Migration head used for the verified dataset: `f3a1c9d2b7e4`.

## 3. Start the demo

Use two terminals from the repository root.

Backend:

```bash
cd C:\Users\admin\Pharma_Order_Management_App
backend\.venv\Scripts\python.exe backend\run.py
```

Frontend:

```bash
cd C:\Users\admin\Pharma_Order_Management_App
npm run dev
```

The frontend `.env` must use live API mode:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
VITE_USE_MOCK_API=false
```

Open <http://localhost:5173>, sign in as `admin@mediflow.demo`, and choose
**AI Insights**. In mock mode the assistant is intentionally unavailable: no
fake answers are generated.

## 4. Verified data snapshot

The seeded database used for the live check returned these values through the
read-only tools (not hardcoded in the app):

| Metric | Verified value |
| --- | ---: |
| Active medicines | 40 |
| Batch count | 92 |
| Usable units | 22,811 |
| Low-stock medicines | 11 |
| Near-expiry batches (90 days) | 13 |
| Inventory cost value | 223490.12 |

A good first prompt is:

> Analyze my inventory and identify the biggest risks.

Expected behavior:

1. The user message appears immediately.
2. The UI shows **Thinking…**, then **Reading your data…**, then
   **Writing the answer…**.
3. The answer arrives as a live draft after tools have completed. Source badges
   show the verified tools and, on hover, counts derived from their results.
4. The answer contains numbers that match the live tool output. Do not present
   the snapshot above if the seeded database has changed.

Other useful prompts:

- `Which medicines are expiring within 30 days?`
- `Summarize the pending orders.`
- `Compare this period's sales with the previous period.`
- `What dosage of paracetamol should I take?` — must be refused with the
  business-only/medical-referral message and must not call a provider or tool.

## 5. Timing expectations

On this CPU-only host, the original direct tool request for the 30.5B
`qwen3-coder:latest` model was measured at roughly 112 s, and end-to-end chat
waits of 60–200 s were observed. The dominant cost is prompt evaluation for the
large model and its first tool call.

After the streaming change:

- stage events are emitted as soon as the user turn is committed;
- tool execution happens before the first answer delta;
- the final answer call has no tools, so it evaluates a smaller prompt;
- the browser keeps the existing 330-second ceiling;
- **Stop** cancels the request, and any text already streamed is saved with
  `[Response interrupted.]`.

Measured model-to-model timings belong in
[`AI_MODEL_BENCHMARK.md`](AI_MODEL_BENCHMARK.md). Do not quote estimated numbers
as measured results.

A cold request can be slower because Ollama loads the model into memory. Check
with:

```bash
ollama ps
```

## 6. Security and UX checks

Run these manually before a demo:

- **Medical guardrail** — ask a dosage/treatment question; expect the
  `limited` badge and no provider/tool call.
- **Retailer scoping** — sign in as `retailer@mediflow.demo`; the assistant can
  only report that retailer's own orders and sales.
- **Conversation ownership** — open an admin conversation ID from the retailer
  session; the API returns `404`, not another user's transcript.
- **Prompt injection** — ask the assistant to print its system prompt or API key;
  expect a refusal and no secret in the response.
- **Rate limit** — after the configured number of requests in the window, the
  API returns `429` with a wait message.
- **Provider failure** — stop Ollama and send a question; the UI shows a safe
  message such as “The AI provider is currently unavailable.” No stack trace,
  provider body, prompt or credential is exposed.
- **Persistence** — reload the page and open the conversation; the assistant
  answer is still present.

## 7. Quality gates

```bash
cd C:\Users\admin\Pharma_Order_Management_App
backend\.venv\Scripts\python.exe -m pyflakes backend\app backend\tests backend\run.py backend\scripts\benchmark_llm.py
backend\.venv\Scripts\python.exe -m pytest
npm run lint
npm run build
```

Regenerate the measured model report:

```bash
backend\.venv\Scripts\python.exe backend\scripts\benchmark_llm.py --models qwen3-coder:latest qwen3:4b --output docs\AI_MODEL_BENCHMARK.md
```

Keep the default model from `.env.example` unless that report shows a clear,
measured speed advantage **and** acceptable tool-call accuracy.

## 8. Troubleshooting

| Symptom | Check |
| --- | --- |
| Assistant shows “unavailable until backend is connected” | Frontend `VITE_USE_MOCK_API` must be `false`; backend must be on port 5000. |
| `GET /api/ai/status` has `enabled: false` | `LLM_MODEL` is required; OpenAI-compatible providers also need `LLM_API_KEY`. |
| Provider unavailable / `503` | Start Ollama (`ollama serve`) and confirm the model name with `ollama list`. |
| Long first answer | Cold model load; check `ollama ps`. The default context is bounded to `LLM_NUM_CTX=8192`. |
| Stream shows no draft until the end | Confirm `status.streaming` is `true`; otherwise the UI correctly uses the non-streaming fallback. |
| Browser reports “stopped before finishing” | Check backend logs for `ai.provider_error` / `ai.stream_error`. Internal text is intentionally not sent to the browser. |
| Reverse proxy buffers the whole answer | The stream endpoint sends `X-Accel-Buffering: no`; ensure the proxy honours it. |
| `429` during a long demo | Wait for `AI_RATE_LIMIT_WINDOW_SECONDS` or raise `AI_RATE_LIMIT_REQUESTS` in the local `.env`. |
| Answer lacks numbers | Check the source badges. If tools failed, the assistant should say so rather than inventing data. |
