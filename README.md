# JURO

JURO is a local desktop app for deliberate Java coding practice.

The core idea is simple: JURO owns the study system, while your editor and your LLM do the heavy lifting. JURO stores a personal problem bank, opens each problem in a local Java workspace, runs the tests, records explanation practice, and schedules future reviews. An LLM can be connected to evaluate your explanations and can also be used to populate or maintain the problem bank.

JURO is not an in-browser coding IDE. Coding happens locally in your preferred editor, such as VS Code or Neovim. JURO is the launcher, problem bank, test runner, explanation checker, and spaced-repetition scheduler.

## What JURO Can Do

- Maintain a local Java problem bank.
- Create and edit problems with descriptions, constraints, examples, test cases, starter code, reference solutions, solution videos, and knowledge rubrics.
- Generate a local Java scaffold for the selected problem.
- Open the scaffold in VS Code or Neovim.
- Run deterministic Java tests from the desktop app.
- Track coding review and explanation review separately.
- Use an LLM to evaluate a written or spoken explanation.
- Schedule future reviews with spaced repetition.
- Export, import, and live-sync the problem bank as JSON.
- Let an external LLM edit that JSON so problems can be created without hand-authoring every field in the UI.

## Ideal Workflow

The intended workflow is:

1. Connect an LLM provider in Settings.
2. Use the LLM to create or expand your problem bank.
3. Import or live-sync the generated JSON into JURO.
4. Pick a problem from the Problem Bank.
5. Open it in your preferred editor.
6. Solve it in `src/Solution.java`.
7. Return to JURO and run the tests.
8. Explain your solution using text or speech.
9. Let the configured LLM grade the explanation against the problem rubric.
10. Mark the coding and explanation reviews as passed or needing work.
11. Let JURO schedule the next review.

This creates a loop where the LLM helps build the curriculum, but JURO keeps the practice deterministic: real files, real Java tests, and review state stored locally.

## LLM Integration

JURO currently supports these AI providers for explanation evaluation:

- Ollama
- Codex Adapter
- Anthropic Claude
- Anthropic Claude

The LLM is used for knowledge checks. JURO sends the problem description, the knowledge rubric, and your explanation transcript to the configured provider. The provider returns structured feedback, and you decide whether to grade the explanation as passed or needing review.

### Ollama

Use this if you want local models:

```text
Provider: Ollama
Base URL: http://localhost:11434
Model: llama3.1
```

### Codex Adapter

Use this if you have an OpenAI-compatible local Codex adapter:

```text
Provider: Codex Adapter
Base URL: http://127.0.0.1:11435/v1/
Model: gpt-5.4
```

### Anthropic Claude

Use this if you want to call Anthropic directly:

```text
Provider: Anthropic Claude
Base URL: https://api.anthropic.com
Model: claude-sonnet-4-20250514
API key: your Anthropic API key
```

The API key is saved in JURO local settings on your machine.

## Populating Problems With an LLM

The best way to use an LLM to create problems is through the Problem Bank JSON format.

JURO has two JSON-based workflows:

- Export/import: export the bank, ask an LLM to edit the JSON, then import it back.
- Live JSON sync: configure one JSON file that JURO watches while the app is running.

The live-sync workflow is the easiest for LLM-assisted authoring:

1. Open Settings.
2. Go to Problem Bank Backup.
3. Enable Live JSON sync.
4. Choose a file path, for example `~/juro-workspace/juro-problem-bank.json`.
5. Click Write sync file.
6. Open that JSON file in an editor or LLM tool.
7. Ask the LLM to add, improve, or rewrite problems.
8. Save the JSON file.
9. JURO detects the change and imports it automatically.

The LLM should preserve the JSON structure and create complete problems. Each problem needs:

- `slug`
- `title`
- `summary`
- `descriptionMarkdown`
- `constraintsMarkdown`
- `type` set to `JAVA`
- `difficulty`
- `starterCode`
- `referenceSolution`
- `solutionVideoUrl`
- `knowledgeRubric`
- at least 3 examples
- at least 3 runnable test cases
- review states
- submissions array, usually empty for new problems

Import matches by `slug`. If the slug already exists, JURO updates that problem. If the slug is new, JURO creates a new problem.

## Prompt For Generating Problems

Use a prompt like this with your LLM:

```text
You are editing a JURO problem bank JSON file.

Add 5 Java algorithm problems.

Rules:
- Preserve the existing top-level JSON shape.
- Do not remove existing problems.
- Each new problem must have a unique slug.
- Set type to JAVA.
- Include at least 3 examples.
- Include at least 3 runnable test cases.
- Test case inputData and expectedOutput must be valid JSON strings.
- Include starterCode with an empty or incomplete Java solve method.
- Include referenceSolution with a correct Java implementation.
- Include a knowledgeRubric that explains what a strong verbal explanation must cover.
- Set submissions to [] for new problems.
- Include CODING and EXPLANATION review states.

Create problems that are useful for spaced repetition and interview preparation.
```

After saving the edited JSON, JURO will import it through live sync if that feature is enabled.

## Problem Model

JURO problems are Java-only for now.

A problem contains prompt content, runnable examples, hidden or visible test cases, code templates, a reference solution, and a rubric for explanation review. The tests are used for coding review. The rubric is used by the LLM for explanation review.

Coding review and explanation review are separate because they train different skills:

- Coding review asks: can you implement the solution and pass the tests?
- Explanation review asks: can you explain the algorithm, edge cases, correctness, and complexity?

## Local Data

JURO stores data locally.

In desktop mode, the Tauri shell starts a Spring Boot backend on:

```text
http://127.0.0.1:18191
```

The backend stores app data in an H2 file database. The database file is not meant to be edited directly. Use the app UI, the API, import/export JSON, or live JSON sync instead.

JURO also creates one generated workspace at:

```text
workspace-directory/juro-current
```

Opening a different problem deletes and rebuilds that folder for the selected problem.

## Requirements

To use JURO:

- Java 17 or newer
- VS Code with the `code` command available on PATH, or Neovim with `nvim` available on PATH
- optional LLM provider: Ollama, Codex Adapter, or Anthropic Claude

To build JURO from source:

- Node.js 22 or newer
- npm
- Rust and Cargo
- Java 17 or newer
- Tauri platform dependencies for your OS

## Run From Source

Install frontend dependencies:

```bash
cd frontend
npm install --registry=https://registry.npmjs.org/
```

Run the desktop app in development mode:

```bash
cd frontend
npm run tauri:dev
```

The Tauri dev command packages the Spring Boot backend, starts the frontend dev server, launches the desktop shell, and starts the backend on `127.0.0.1:18191`.

## Verification

Run backend tests:

```bash
cd backend
MAVEN_OPTS='-Djava.io.tmpdir=../.tmp' TMPDIR=../.tmp mvn -s ../.mvn/public-settings.xml -Dmaven.repo.local=../.m2repo test
```

Run the frontend build:

```bash
cd frontend
npm run build
```

## Project Structure

```text
backend/
  Spring Boot API, H2 persistence, Java scaffold generation, test running,
  AI evaluation, review scheduling, settings, and problem-bank import/export.

frontend/
  React + TypeScript UI for the Problem Bank, Settings, Knowledge Check,
  local workspace controls, and authoring flows.

frontend/src-tauri/
  Tauri desktop shell and Rust launcher that starts/stops the backend.
```
