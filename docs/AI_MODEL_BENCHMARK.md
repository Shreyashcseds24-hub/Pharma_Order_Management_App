# AI model benchmark

Measured locally with `backend/scripts/benchmark_llm.py`. Every value below comes from a real Ollama `/api/chat` streaming response; no estimated or hard-coded timings are included.

- Run at: `2026-11-19T18:11:54+00:00`
- Ollama: `0.40.16` at `http://127.0.0.1:11434`
- Host: Intel64 Family 6 Model 60 Stepping 3, GenuineIntel · Windows 11
- Options: `num_ctx=8192`, `num_predict=400`, temperature `0.2`, same system prompt and nine tool schemas as the app.
- Tools are **not executed** during the benchmark; tool-call accuracy is measured against the tool requested by each identical prompt.

## Model metadata

| Model | Size on disk | Advertised capabilities | Parameter size | Quantization |
| --- | --- | --- | --- | --- |
| `qwen3-coder:latest` | 18.56 GB | completion, tools | 30.5B | Q4_K_M |
| `qwen3:4b` | 2.50 GB | completion, tools, thinking | 4.0B | Q4_K_M |

## Measured results

| Model | Scenario | First response (s) | Total (s) | Tokens/s | Tools called | Tool call valid | Tool accurate | Complete | Answer excerpt |
| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| `qwen3-coder:latest` | Simple conversational completion | 117.38 | 136.08 | 4.4 | none | no | yes | yes | Hello! I can help you with: • Current inventory levels and stock status • Sales reports and order history • Expiry date tracking for medicat… |
| `qwen3-coder:latest` | Single-tool request | 66.05 | 66.72 | 1.64 | get_inventory_summary | yes | yes | yes | — |
| `qwen3-coder:latest` | Multi-tool request | 18.86 | 25.44 | 3.0 | get_pending_orders | yes | no | yes | — |
| `qwen3-coder:latest` | Follow-up question | 11.22 | 11.44 | 4.83 | get_expiring_medicines | yes | yes | yes | — |
| `qwen3-coder:latest` | Inventory analysis question | 6.11 | 21.06 | 4.32 | get_expiring_medicines | yes | no | yes | — |
| `qwen3:4b` | Simple conversational completion | n/a | 97.06 | 5.47 | none | no | yes | no | — |
| `qwen3:4b` | Single-tool request | 75.89 | 76.41 | 4.97 | get_inventory_summary | yes | yes | yes | — |
| `qwen3:4b` | Multi-tool request | n/a | 80.05 | 5.12 | none | no | no | no | — |
| `qwen3:4b` | Follow-up question | n/a | 84.72 | 4.89 | none | no | no | no | — |
| `qwen3:4b` | Inventory analysis question | n/a | 78.67 | 5.17 | none | no | no | no | — |

## Metric definitions

- **First response** — elapsed time until the first text delta or tool call fragment arrived in the stream. The model is loaded into memory before this point on a cold request, so cold and warm runs differ.
- **Total** — elapsed time until Ollama marked the stream done.
- **Tokens/s** — Ollama's `eval_count / eval_duration` from the final stream event; shown only when both values were reported.
- **Tool call valid** — every requested tool name is in the application's nine-tool whitelist and arguments were parseable objects.
- **Tool accurate** — the calls matched the tool(s) required by that scenario; the analysis prompt allows any combination of inventory summary, low-stock and expiring-batch tools.
- **Complete** — a substantive text answer for the conversational prompt, or at least one valid tool call for the tool prompts.

## Decision

**Keep `qwen3-coder:latest` as the default assistant model.** It completed 5/5 measured scenarios and was tool-accurate in 3/4 tool scenarios. `qwen3:4b` completed 1/5 scenarios and was tool-accurate in 1/4; its simple completion and three tool scenarios reached the 400-token cap with empty content, so its higher raw tokens/s does not translate into usable answers.

- `qwen3:4b` total-time comparison (`qwen3:4b` / winner): single-tool 76.41s vs 66.72s; follow-up 84.72s vs 11.44s; inventory analysis 78.67s vs 21.06s.
- The cold simple completion was the only scenario where `qwen3:4b` was faster (97.06s vs 136.08s for `qwen3-coder:latest`); that run was still incomplete. The 30.5B model's cold run included 82.89s of Ollama model loading.

The smaller model is not a like-for-like replacement at this prompt and token budget: tool-call reliability and completed answers matter more than a higher token rate. Re-run this benchmark before changing the default in `backend/.env.example`.

## Reproduction

```bash
backend/.venv/Scripts/python.exe backend/scripts/benchmark_llm.py \
  --models qwen3-coder:latest qwen3:4b \
  --base-url http://127.0.0.1:11434 --num-ctx 8192 \
  --num-predict 400 --timeout 600 \
  --output docs\AI_MODEL_BENCHMARK.md
```
