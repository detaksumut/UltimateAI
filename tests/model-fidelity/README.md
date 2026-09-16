# Model Fidelity & Context Baseline Benchmark (Hermes3 vs Qwen3)

## 1. Overview
This benchmark suite measures the **RAW, UNASSISTED** capability of local LLMs (`hermes3:8b` and `qwen3:8b`) to extract, reason over, and maintain fidelity to complex technical and legal specifications (specifically the AT-RQS™ v1.0 standard), without:
- Prompt engineering / guidance injection
- Autonomous agent retrieval / correction loops
- Hardcoded knowledge or heuristics
- Semantic rewrite layers

## 2. Directory Structure
- `cases/`: Test case definitions (30–50 cases across Categories A to J).
- `gold/`: Gold-standard facts extracted deterministically from the source document.
- `runners/`: Raw inference runners executing identical prompts against Ollama models.
- `outputs/`:
  - `hermes3/`: Raw model outputs from Hermes 3:8B.
  - `qwen3/`: Raw model outputs from Qwen3:8B.
- `evaluator/`: Error taxonomy evaluator implementing E01–E12.
- `reports/`: Evaluated benchmark scores and detailed error distribution.

## 3. Evaluation Taxonomy
- `E01`: Factual Error
- `E02`: Terminology Substitution
- `E03`: Numerical Mutation
- `E04`: Formula Mutation
- `E05`: Structural Error
- `E06`: Context Loss
- `E07`: Contradiction Blindness
- `E08`: Unsupported Inference
- `E09`: Hallucination
- `E10`: Overclaim
- `E11`: Instruction Drift
- `E12`: Citation/Evidence Failure
