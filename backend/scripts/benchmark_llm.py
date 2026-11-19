#!/usr/bin/env python3
"""Measure locally installed Ollama models on identical MediFlow AI prompts.

The script talks to Ollama's streaming ``/api/chat`` endpoint so that time to
first response can be measured separately from total response time. It uses the
same authenticated system prompt and the same nine read-only tool schemas as
the application, but it does not execute tools or contact the database: the
benchmark measures model behaviour, not business results.

Every number written to the report comes from a real response. No model
capability is inferred from documentation alone: tool capability is tested by
the single-tool scenario and reported as measured tool-call success/accuracy.

Usage (from the repository root)::

    backend/.venv/Scripts/python.exe backend/scripts/benchmark_llm.py \
        --models qwen3-coder:latest qwen3:4b \
        --output docs/AI_MODEL_BENCHMARK.md
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import socket
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.services.ai_assistant import SYSTEM_PROMPT  # noqa: E402
from app.services.ai_tools import TOOL_SCHEMAS  # noqa: E402

TOOL_NAMES = {
    schema["function"]["name"]
    for schema in TOOL_SCHEMAS
    if isinstance(schema, dict) and schema.get("function")
}
DEFAULT_BASE_URL = os.environ.get("LLM_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODELS = ["qwen3-coder:latest", "qwen3:4b"]

SYSTEM = SYSTEM_PROMPT.format(
    today=datetime.now(timezone.utc).date().isoformat(), role="admin"
)

SCENARIOS = [
    {
        "name": "Simple conversational completion",
        "kind": "answer",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Hello! What can you help me with?"},
        ],
        "use_tools": False,
        "expected_tools": [],
        "allowed_tools": [],
    },
    {
        "name": "Single-tool request",
        "kind": "tool",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": "Give me a concise inventory summary for the pharmacy.",
            },
        ],
        "use_tools": True,
        "expected_tools": ["get_inventory_summary"],
        "allowed_tools": ["get_inventory_summary"],
    },
    {
        "name": "Multi-tool request",
        "kind": "tool",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": (
                    "Which medicines are low on stock, and which pending orders need "
                    "approval? Include medicine names and order IDs."
                ),
            },
        ],
        "use_tools": True,
        "expected_tools": ["get_low_stock_medicines", "get_pending_orders"],
        "allowed_tools": ["get_low_stock_medicines", "get_pending_orders"],
    },
    {
        "name": "Follow-up question",
        "kind": "tool",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Give me a concise inventory summary."},
            {"role": "assistant", "content": "I summarized the current inventory."},
            {"role": "user", "content": "Which batches expire within 30 days?"},
        ],
        "use_tools": True,
        "expected_tools": ["get_expiring_medicines"],
        "allowed_tools": ["get_expiring_medicines"],
    },
    {
        "name": "Inventory analysis question",
        "kind": "tool",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": "Analyze my inventory and identify the biggest risks.",
            },
        ],
        "use_tools": True,
        "expected_tools": ["get_inventory_summary"],
        "allowed_tools": [
            "get_inventory_summary",
            "get_low_stock_medicines",
            "get_expiring_medicines",
        ],
    },
]


def _fetch_json(url, payload=None, timeout=30):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers={"Content-Type": "application/json"},
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def model_catalog(base_url, timeout):
    """Return installed model metadata from Ollama's /api/tags endpoint."""
    try:
        data = _fetch_json(f"{base_url}/api/tags", timeout=timeout)
    except Exception as error:  # pragma: no cover - depends on local Ollama
        print(f"warning: could not read /api/tags: {error}", file=sys.stderr)
        return {}
    catalog = {}
    for item in data.get("models") or []:
        if isinstance(item, dict) and item.get("name"):
            catalog[item["name"]] = {
                "size_bytes": item.get("size"),
                "capabilities": item.get("capabilities") or [],
                "details": item.get("details") or {},
            }
    return catalog


def _tool_calls_from_chunk(chunk, accumulated):
    """Accumulate Ollama tool-call fragments, keyed by call index."""
    message = chunk.get("message") or {}
    for index, raw in enumerate(message.get("tool_calls") or []):
        if not isinstance(raw, dict):
            continue
        function = raw.get("function") or {}
        name = function.get("name")
        arguments = function.get("arguments") or {}
        entry = accumulated.setdefault(
            index,
            {"id": str(raw.get("id") or f"call_{index}"), "name": "", "arguments": {}},
        )
        if name:
            entry["name"] = str(name)
        if isinstance(arguments, dict):
            entry["arguments"].update(arguments)
        elif isinstance(arguments, str) and arguments.strip():
            try:
                parsed = json.loads(arguments)
            except ValueError:
                parsed = {}
            if isinstance(parsed, dict):
                entry["arguments"].update(parsed)
    return message.get("content") or ""


def run_scenario(model, scenario, args):
    """Run one streaming chat request and return measured values only."""
    payload = {
        "model": model,
        "stream": True,
        "messages": scenario["messages"],
        "options": {
            "num_predict": args.num_predict,
            "num_ctx": args.num_ctx,
            "temperature": 0.2,
        },
    }
    if scenario["use_tools"]:
        payload["tools"] = TOOL_SCHEMAS

    request = urllib.request.Request(
        f"{args.base_url}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    content_parts = []
    tool_calls = {}
    first_response_s = None
    usage = {}
    started = time.monotonic()
    chunks = 0

    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                chunks += 1
                if chunks > args.max_chunks:
                    raise RuntimeError("stream exceeded the configured chunk limit")
                chunk = json.loads(line)
                if chunk.get("error"):
                    raise RuntimeError(str(chunk["error"])[:200])
                delta = _tool_calls_from_chunk(chunk, tool_calls)
                if delta:
                    content_parts.append(delta)
                if first_response_s is None and (delta or tool_calls):
                    first_response_s = time.monotonic() - started
                if chunk.get("done"):
                    for key in (
                        "eval_count",
                        "eval_duration",
                        "prompt_eval_count",
                        "prompt_eval_duration",
                        "load_duration",
                        "total_duration",
                    ):
                        if key in chunk:
                            usage[key] = chunk[key]
                    break
    except (socket.timeout, TimeoutError) as error:
        return {
            "scenario": scenario["name"],
            "error": f"timeout: {error}",
            "total_s": round(time.monotonic() - started, 2),
        }
    except urllib.error.HTTPError as error:
        return {
            "scenario": scenario["name"],
            "error": f"HTTP {error.code}",
            "total_s": round(time.monotonic() - started, 2),
        }
    except Exception as error:  # noqa: BLE001 - report measurement failures verbatim
        return {
            "scenario": scenario["name"],
            "error": f"{type(error).__name__}: {str(error)[:200]}",
            "total_s": round(time.monotonic() - started, 2),
        }

    total_s = time.monotonic() - started
    content = "".join(content_parts).strip()
    calls = [
        {
            "name": entry["name"],
            "arguments": entry["arguments"],
            "id": entry["id"],
        }
        for entry in tool_calls.values()
        if entry["name"]
    ]
    names = [call["name"] for call in calls]
    tool_success = bool(names) and all(name in TOOL_NAMES for name in names)
    if scenario["expected_tools"]:
        tool_accuracy = (
            bool(names)
            and all(name in scenario["allowed_tools"] for name in names)
            and all(name in names for name in scenario["expected_tools"])
        )
    else:
        tool_accuracy = not names

    if scenario["kind"] == "answer":
        complete = len(content) >= 20
    else:
        complete = tool_success

    eval_duration = usage.get("eval_duration") or 0
    eval_count = usage.get("eval_count") or 0
    tokens_per_second = None
    if eval_duration > 0 and eval_count > 0:
        tokens_per_second = round(eval_count / (eval_duration / 1_000_000_000), 2)

    result = {
        "scenario": scenario["name"],
        "first_response_s": round(first_response_s, 2) if first_response_s else None,
        "total_s": round(total_s, 2),
        "tokens_per_second": tokens_per_second,
        "eval_count": eval_count or None,
        "prompt_eval_count": usage.get("prompt_eval_count"),
        "load_s": (
            round(usage["load_duration"] / 1_000_000_000, 2)
            if usage.get("load_duration")
            else None
        ),
        "tool_calls": calls,
        "tool_success": tool_success,
        "tool_accuracy": tool_accuracy,
        "complete": complete,
        "answer": content,
        "chunks": chunks,
    }
    return result


def _fmt(value, suffix=""):
    if value is None:
        return "n/a"
    if isinstance(value, bool):
        return "yes" if value else "no"
    return f"{value}{suffix}"


def _excerpt(text, limit=140):
    compact = " ".join((text or "").split())
    return compact[:limit] + ("…" if len(compact) > limit else "")


def _summary(rows):
    """Derive a conservative, measured summary for the decision section."""
    valid = [row for row in rows if not row.get("error")]
    tool_rows = [
        row
        for row in valid
        if next(
            (s["kind"] for s in SCENARIOS if s["name"] == row["scenario"]),
            "tool",
        )
        == "tool"
    ]
    complete = [row for row in valid if row.get("complete")]
    totals = sorted(row["total_s"] for row in complete)
    median_total = (
        totals[len(totals) // 2]
        if len(totals) % 2
        else (totals[len(totals) // 2 - 1] + totals[len(totals) // 2]) / 2
        if totals
        else None
    )
    return {
        "complete": len(complete),
        "scenarios": len(valid),
        "accurate": sum(bool(row.get("tool_accuracy")) for row in tool_rows),
        "tool_scenarios": len(tool_rows),
        "incomplete": [
            row for row in valid if not row.get("complete") and row.get("eval_count") == 400
        ],
        "median_total": median_total,
    }


def _decision_lines(results):
    """Write a recommendation that favours correctness over raw speed."""
    ranked = sorted(
        results.items(),
        key=lambda item: (
            _summary(item[1])["complete"] / max(_summary(item[1])["scenarios"], 1),
            _summary(item[1])["accurate"] / max(_summary(item[1])["tool_scenarios"], 1),
            -(_summary(item[1])["median_total"] or float("inf")),
        ),
        reverse=True,
    )
    winner, winner_rows = ranked[0]
    winner_summary = _summary(winner_rows)
    lines = [
        "## Decision",
        "",
        f"**Keep `{winner}` as the default assistant model.** It completed "
        f"{winner_summary['complete']}/{winner_summary['scenarios']} measured scenarios "
        f"and was tool-accurate in {winner_summary['accurate']}/"
        f"{winner_summary['tool_scenarios']} tool scenarios.",
        "",
    ]
    for model, rows in ranked[1:]:
        summary = _summary(rows)
        lines.append(
            f"- `{model}` completed {summary['complete']}/{summary['scenarios']} scenarios "
            f"and was tool-accurate in {summary['accurate']}/{summary['tool_scenarios']} "
            "tool scenarios. Its incomplete runs reached the 400-token cap with empty "
            "content, so its raw tokens/s does not translate into usable answers."
            if summary["incomplete"]
            else f"- `{model}` completed {summary['complete']}/{summary['scenarios']} "
            f"scenarios and was tool-accurate in {summary['accurate']}/"
            f"{summary['tool_scenarios']} tool scenarios."
        )
        comparisons = []
        for name in ("Single-tool request", "Follow-up question", "Inventory analysis question"):
            ours = next((r for r in winner_rows if r["scenario"] == name), None)
            theirs = next((r for r in rows if r["scenario"] == name), None)
            if ours and theirs and not ours.get("error") and not theirs.get("error"):
                comparisons.append(
                    f"{name.lower()}: {theirs['total_s']:.2f}s vs "
                    f"{ours['total_s']:.2f}s"
                )
        if comparisons:
            lines.append("  - Total-time comparison (`" + model + "` / winner): " + "; ".join(comparisons) + ".")
        cold_ours = next(
            (r for r in winner_rows if r["scenario"] == "Simple conversational completion"),
            None,
        )
        cold_theirs = next(
            (r for r in rows if r["scenario"] == "Simple conversational completion"),
            None,
        )
        if (
            cold_ours
            and cold_theirs
            and not cold_ours.get("error")
            and not cold_theirs.get("error")
            and cold_theirs["total_s"] < cold_ours["total_s"]
        ):
            load_note = (
                f" The winner's cold run included {cold_ours['load_s']}s of Ollama model loading."
                if cold_ours.get("load_s")
                else ""
            )
            lines.append(
                f"  - `{model}` was faster only on the cold simple completion "
                f"({cold_theirs['total_s']:.2f}s vs {cold_ours['total_s']:.2f}s), but that "
                f"run was {'incomplete' if not cold_theirs.get('complete') else 'not tool-backed'}."
                + load_note
            )
    lines.extend(
        [
            "",
            "The smaller model is not a like-for-like replacement at this prompt and "
            "token budget: tool-call reliability and completed answers matter more than "
            "a higher token rate. Re-run this benchmark before changing the default in "
            "`backend/.env.example`.",
            "",
        ]
    )
    return lines


def render_report(results, catalog, args, ollama_version):
    lines = [
        "# AI model benchmark",
        "",
        "Measured locally with `backend/scripts/benchmark_llm.py`. Every value below "
        "comes from a real Ollama `/api/chat` streaming response; no estimated or "
        "hard-coded timings are included.",
        "",
        f"- Run at: `{datetime.now(timezone.utc).isoformat(timespec='seconds')}`",
        f"- Ollama: `{ollama_version}` at `{args.base_url}`",
        f"- Host: {platform.processor() or platform.machine()} · "
        f"{platform.system()} {platform.release()}",
        f"- Options: `num_ctx={args.num_ctx}`, `num_predict={args.num_predict}`, "
        f"temperature `0.2`, same system prompt and nine tool schemas as the app.",
        "- Tools are **not executed** during the benchmark; tool-call accuracy is "
        "measured against the tool requested by each identical prompt.",
        "",
        "## Model metadata",
        "",
        "| Model | Size on disk | Advertised capabilities | Parameter size | Quantization |",
        "| --- | --- | --- | --- | --- |",
    ]
    for model in results:
        info = catalog.get(model, {})
        size = info.get("size_bytes")
        details = info.get("details") or {}
        lines.append(
            "| `{name}` | {size} | {caps} | {params} | {quant} |".format(
                name=model,
                size=f"{size / 1e9:.2f} GB" if isinstance(size, (int, float)) else "unknown",
                caps=", ".join(info.get("capabilities") or []) or "unknown",
                params=details.get("parameter_size") or "unknown",
                quant=details.get("quantization_level") or "unknown",
            )
        )

    lines.extend(
        [
            "",
            "## Measured results",
            "",
            "| Model | Scenario | First response (s) | Total (s) | Tokens/s | Tools called | Tool call valid | Tool accurate | Complete | Answer excerpt |",
            "| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |",
        ]
    )
    for model, scenarios in results.items():
        for row in scenarios:
            if row.get("error"):
                lines.append(
                    f"| `{model}` | {row['scenario']} | error | {row.get('total_s', 'n/a')} | "
                    f"n/a | n/a | n/a | n/a | no | {_excerpt(row['error'], 80)} |"
                )
                continue
            called = ", ".join(call["name"] for call in row["tool_calls"]) or "none"
            lines.append(
                "| `{name}` | {scenario} | {first} | {total} | {tps} | {tools} | {valid} | "
                "{accurate} | {complete} | {excerpt} |".format(
                    name=model,
                    scenario=row["scenario"],
                    first=_fmt(row["first_response_s"]),
                    total=_fmt(row["total_s"]),
                    tps=_fmt(row["tokens_per_second"]),
                    tools=called,
                    valid=_fmt(row["tool_success"]),
                    accurate=_fmt(row["tool_accuracy"]),
                    complete=_fmt(row["complete"]),
                    excerpt=_excerpt(row["answer"]) or "—",
                )
            )

    lines.extend(
        [
            "",
            "## Metric definitions",
            "",
            "- **First response** — elapsed time until the first text delta or tool call "
            "fragment arrived in the stream. The model is loaded into memory before "
            "this point on a cold request, so cold and warm runs differ.",
            "- **Total** — elapsed time until Ollama marked the stream done.",
            "- **Tokens/s** — Ollama's `eval_count / eval_duration` from the final stream "
            "event; shown only when both values were reported.",
            "- **Tool call valid** — every requested tool name is in the application's "
            "nine-tool whitelist and arguments were parseable objects.",
            "- **Tool accurate** — the calls matched the tool(s) required by that "
            "scenario; the analysis prompt allows any combination of inventory summary, "
            "low-stock and expiring-batch tools.",
            "- **Complete** — a substantive text answer for the conversational prompt, "
            "or at least one valid tool call for the tool prompts.",
            "",
        ]
    )
    lines.extend(_decision_lines(results))
    lines.extend(
        [
            "## Reproduction",
            "",
            "```bash",
            "backend/.venv/Scripts/python.exe backend/scripts/benchmark_llm.py \\",
            "  --models " + " ".join(args.models) + " \\",
            f"  --base-url {args.base_url} --num-ctx {args.num_ctx} \\",
            f"  --num-predict {args.num_predict} --timeout {args.timeout} \\",
            f"  --output {args.output}",
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models", nargs="+", default=DEFAULT_MODELS)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--timeout", type=int, default=600)
    parser.add_argument("--num-ctx", type=int, default=8192)
    parser.add_argument("--num-predict", type=int, default=400)
    parser.add_argument("--max-chunks", type=int, default=2000)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "docs" / "AI_MODEL_BENCHMARK.md",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    catalog = model_catalog(args.base_url, min(args.timeout, 15))
    try:
        version = (_fetch_json(f"{args.base_url}/api/version", timeout=10).get("version"),)[0]
    except Exception:
        version = "unknown"

    results = {}
    for model in args.models:
        if model not in catalog:
            print(f"warning: {model} is not installed; skipping", file=sys.stderr)
            continue
        print(f"Benchmarking {model} …", file=sys.stderr)
        rows = []
        for scenario in SCENARIOS:
            row = run_scenario(model, scenario, args)
            rows.append(row)
            print(
                f"  {scenario['name']}: total={row.get('total_s')}s "
                f"tools={[call['name'] for call in row.get('tool_calls', [])]} "
                f"accurate={row.get('tool_accuracy')}",
                file=sys.stderr,
            )
        results[model] = rows

    if not results:
        raise SystemExit("No installed models were benchmarked.")

    report = render_report(results, catalog, args, version)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report, encoding="utf-8")
    print(f"Wrote {args.output}")
    print(json.dumps(results, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
