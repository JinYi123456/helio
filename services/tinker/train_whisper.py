"""Fine-tune Helio's whisper voice with Tinker (Thinking Machines).

Reads dataset/whisper_pairs.jsonl (context JSON → whisper), trains a LoRA on a
small open-weight base model, saves sampler weights, and optionally samples a
few whispers so you can hear the voice before wiring it anywhere.

    TINKER_API_KEY=... python train_whisper.py --epochs 3

Costs scale with tokens — with ~250 short rows this is cents, not dollars.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import tinker

HERE = Path(__file__).parent
DEFAULT_DATASET = HERE / "dataset" / "whisper_pairs.jsonl"

USER_PREFIX = "WRITE THE WHISPER"

SYSTEM = (
    "You write ONE whisper for Helio, an outdoors app. Voice: quiet, concrete, a little wry. "
    "Second person, present. 1-2 sentences, under 30 words. No emojis, no quotes, no greetings. "
    "The whisper sends a specific person outside to find ONE specific thing nearby."
)


def user_text(context: dict) -> str:
    return f"{USER_PREFIX}\n{json.dumps(context, ensure_ascii=False, separators=(',', ':'))}"


def load_rows(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def build_datum(tok, row: dict) -> "tinker.Datum":
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user_text(row["context"])},
        {"role": "assistant", "content": row["whisper"]},
    ]
    full_ids = tok.encode(tok.apply_chat_template(messages, tokenize=False, enable_thinking=False))
    prompt_ids = tok.encode(
        tok.apply_chat_template(messages[:-1], tokenize=False, add_generation_prompt=True, enable_thinking=False)
    )
    n_prompt = len(prompt_ids)
    weights = [0.0] * n_prompt + [1.0] * (len(full_ids) - n_prompt)
    return tinker.Datum(
        model_input=tinker.ModelInput.from_ints(full_ids[:-1]),
        loss_fn_inputs={"target_tokens": full_ids[1:], "weights": weights[1:]},
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    ap.add_argument("--base-model", default="Qwen/Qwen3-8B")
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--name", default="whisper")
    ap.add_argument("--sample", type=int, default=3, help="whispers to sample after training")
    args = ap.parse_args()

    rows = load_rows(args.dataset)
    print(f"dataset: {len(rows)} rows from {args.dataset}")

    svc = tinker.ServiceClient()
    tc = svc.create_lora_training_client(base_model=args.base_model, rank=args.rank)
    tok = tc.get_tokenizer()

    data = [build_datum(tok, r) for r in rows]
    lens = [len(d.model_input.to_ints()) for d in data]
    print(f"tokens: mean {sum(lens)//len(lens)}, max {max(lens)}, total {sum(lens)}")

    batches = [data[i : i + args.batch] for i in range(0, len(data), args.batch)]
    step = 0
    t0 = time.time()
    for epoch in range(args.epochs):
        for batch in batches:
            fb = tc.forward_backward(batch, "cross_entropy")
            opt = tc.optim_step(tinker.AdamParams(learning_rate=args.lr))
            result = fb.result()
            opt.result()
            step += 1
            loss = None
            try:
                loss = sum(result.metrics.get("loss", 0.0) for _ in [0]) if hasattr(result, "metrics") else None
            except Exception:  # noqa: BLE001
                pass
            print(f"  epoch {epoch+1}/{args.epochs} step {step}/{len(batches)*args.epochs} ({time.time()-t0:.0f}s)")

    ckpt = tc.save_weights_for_sampler(name=args.name).result()
    run_id = getattr(tc, "model_id", None) or "unknown"
    info = {
        "base_model": args.base_model,
        "rank": args.rank,
        "epochs": args.epochs,
        "lr": args.lr,
        "rows": len(rows),
        "tokens_forwarded": sum(lens) * args.epochs,
        "sampler_path": getattr(ckpt, "path", None),
        "model_id": str(run_id),
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    (HERE / "run_info.json").write_text(json.dumps(info, indent=2), encoding="utf8")
    print("saved sampler weights:", info["sampler_path"])
    print("run info → services/tinker/run_info.json")

    if args.sample > 0:
        sc = tc.save_weights_and_get_sampling_client()
        ctx = {
            "city": "Petaling Jaya, MY",
            "weekday": "Sat",
            "hour": 7,
            "envs": ["street", "park"],
            "tMax": 31,
            "precip": 12,
            "tags": ["sprout", "grass", "crack"],
            "title": "Pavement Rebels",
        }
        prompt_ids = tok.encode(
            tok.apply_chat_template(
                [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": user_text(ctx)},
                ],
                tokenize=False,
                add_generation_prompt=True,
                enable_thinking=False,
            )
        )
        print("\n— sampled whispers (title: Pavement Rebels) —")
        for i in range(args.sample):
            out = sc.sample(
                prompt=tinker.ModelInput.from_ints(prompt_ids),
                num_samples=1,
                sampling_params=tinker.SamplingParams(max_tokens=80, temperature=0.9),
            ).result()
            text = tok.decode(out.sequences[0].tokens)
            print(f"  {i+1}. {text.strip()}")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # noqa: BLE001
        print("TRAIN FAILED:", err, file=sys.stderr)
        sys.exit(1)
