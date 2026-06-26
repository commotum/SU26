# Codex Runners

Best practices for codex-runners: queue-based batch processors that feed tasks to
Codex CLI and write outputs to the filesystem in a reliable, resumable way.

## Git LFS
- This repo tracks large binary assets with Git LFS, including images, PDFs,
  archives, media files, fonts, and model/binary artifacts.
- After cloning, run `git lfs install` once on your machine, then `git lfs pull`
  in the repo if your Git client does not fetch LFS objects automatically.

## How runners work
- Build a queue from a concrete source (for example, a CSV column or a file list).
- For each entry, derive a stable file stem and resolve the source path.
- Skip work when state says an entry is already done or when output exists
  (unless overwrite is requested).
- Generate a prompt from a template with explicit input and output paths.
- Write to a temp file, run Codex in non-interactive mode, then atomically rename
  the temp file to the final output name.

## Prompting conventions
- Use a template with clear placeholders like `[SOURCE_MD_ABS_PATH]`,
  `[MD_ABS_PATH]`, and `[OUTPUT_FOLDER]`.
- Require a strict output format so the runner can parse and validate results.
- Include a single authoritative field to parse (for example, a class code).
- Constrain the model to use only provided inputs and to quote evidence.

## Codex CLI usage
- Prefer `codex exec` for non-interactive runs; it streams progress to stderr and
  only prints the final answer to stdout.
- Use `--full-auto` when the task must write files. Use
  `--sandbox danger-full-access` only if network access is required.
- Use `-C` and `--add-dir` so Codex runs in the intended repo and can access the
  target directory.
- Use `--json` or `--output-schema` when you need structured output for parsing.
- Use `--skip-git-repo-check` only when you understand the risk and environment.

## Reliability and safety patterns
- Track completed items in a state file (for example,
  `.codex_classification_state.json`) and save after each successful task.
- Log every major event with timestamps for debugging and reruns.
- Clean stale temp files on startup to recover from interrupted runs.
- Validate output before promoting it (minimum size checks, parsing required
  fields).
- Use `os.replace` to make writes atomic and avoid partial outputs.
- Support `--dry-run` to print prompts without running Codex.
- Support `--overwrite` to allow reprocessing when needed.

## Parallelism
- Use a thread pool with a configurable worker count.
- Maintain a shared stop event to allow clean interruption and cancellation.
- Keep per-task logs and progress updates to make batch runs observable.

## Layout and naming conventions
- Keep prompts and references alongside the runner script.
- Use stable output names (for example, `CLASS_<code>.md`) to simplify discovery.
- Keep paths configurable so refactors only require updating defaults or args.
