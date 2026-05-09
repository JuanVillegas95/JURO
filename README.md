# JURO

JURO is a Java-only desktop study app for building and reviewing a personal coding-problem bank.

It is designed for deliberate practice:

- collect and edit coding problems
- launch each problem in a local VS Code workflow
- generate Java scaffolds and runnable test cases
- run deterministic Java tests from JURO
- explain your solution and evaluate the transcript with a local AI provider
- schedule future coding and explanation reviews with spaced repetition

JURO is not an in-browser coding workspace. Coding happens in the local editor. JURO is the authoring tool, launcher, test runner, knowledge-check surface, and review scheduler.

## Current Production Target

The primary production path is a macOS Tauri desktop app. JURO can also be built as a Linux AppImage for Manjaro and other Arch-based desktop distributions.

The desktop app packages:

- React + Vite frontend
- Spring Boot backend jar
- H2 file database for local app data
- local HTTP API started by Tauri on `127.0.0.1:18191`

When the app opens, Tauri starts the bundled Spring Boot backend as a child process. When the app closes, Tauri stops that backend process.

## Requirements

To use the built desktop app:

- macOS, or Manjaro/Linux when using the AppImage build
- Java 17 or newer
- VS Code installed
- VS Code `code` command available on PATH
- optional: Ollama or Codex Adapter for AI knowledge checks

To build from source:

- Node.js 22 or newer
- npm
- Rust and Cargo
- Xcode Command Line Tools on macOS, or Tauri Linux system dependencies on Manjaro/Linux
- Java 17 or newer

## App Workflow

1. Open JURO.
2. Use the Problem Bank to pick a due or new Java problem.
3. Click the problem action to open it in VS Code.
4. JURO deletes and rebuilds the single current local Java scaffold.
5. Implement the solution in `src/Solution.java`.
6. Return to JURO and run the Java tests.
7. Use Knowledge Check to record or type an explanation.
8. Let Ollama or Codex Adapter evaluate the explanation.
9. Mark the result as passed or needs review.
10. JURO schedules the next coding and explanation reviews separately.

## Problem Model

Problems are Java-only and include:

- title, difficulty, and tags
- examples for understanding the prompt
- runnable test cases for the scaffold
- Java method signature and return type metadata
- starter code
- reference solution
- optional solution video URL
- knowledge rubric for AI explanation review

Each problem must have at least three examples and at least three runnable test cases.

## Review Scheduling

JURO tracks two independent review schedules per problem:

- Code: can you implement the solution and pass all tests?
- Explain: can you explain the algorithm, edge cases, correctness, and complexity?

The scheduler uses an SM-2 style spaced repetition algorithm inspired by SuperMemo and Anki. Passing a review increases the interval before the next review. Failing or marking a review as needing work brings the problem back sooner.

Explanation reviews are scheduled more often than coding reviews by default because explaining is faster than fully reimplementing a solution.

Scheduling behavior can be tuned in Settings.

## AI Evaluation

JURO supports two local AI provider modes.

### Ollama

Recommended local setup:

```bash
ollama start
ollama pull llama3.1
```

Use these settings in JURO:

```text
Provider: Ollama
Base URL: http://localhost:11434
Model: llama3.1
```

### Codex Adapter

If you have the OCA API Adapter installed and running:

```bash
oca-api-adapter --host 127.0.0.1 --port 11435 --codex-home "$HOME/.codex"
```

Use these settings in JURO:

```text
Provider: Codex Adapter
Base URL: http://127.0.0.1:11435/v1/
Model: gpt-5.4
```

The Codex Adapter is treated as an OpenAI-compatible local endpoint.

## Transcription

Knowledge Check can use:

- Browser speech: uses browser speech recognition when the runtime supports it.
- Manual text: type or paste the explanation yourself.
- Whisper service: reserved for a separate local transcription service when configured.

The AI evaluator always receives text. Speech features only create the transcript.

## Local Data

The desktop backend runs with the `desktop` Spring profile and stores data locally.

Default desktop backend settings:

```text
API: http://127.0.0.1:18191
Database: H2 file database
Settings file: app data directory / backend / settings.json
Backend logs: app log directory / juro-backend.log
Backend error logs: app log directory / juro-backend-error.log
```

JURO uses one generated scaffold workspace at `workspace-directory/juro-current`. Opening another problem deletes and rebuilds that folder for the newly selected problem.

## Problem Bank Backup

Settings includes Problem Bank Backup controls.

- Export bank downloads a JSON snapshot.
- Import bank restores a JSON snapshot.
- The snapshot includes problems, examples, runnable test cases, starter/reference code, knowledge rubrics, coding and explanation review schedules, due dates, spaced repetition progress, and submission history.
- Import matches problems by slug. Existing problems are updated; new slugs are created.
- For imported problems, review schedules and submission history are replaced with the snapshot data so repeated imports do not duplicate progress.

## Build From Source

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

The Tauri dev command packages the backend jar, starts the frontend dev server, and launches the desktop shell.

## Production Build

Build the macOS app bundle:

```bash
cd frontend
npm run tauri -- build --bundles app
```

The app bundle is produced at:

```text
frontend/src-tauri/target/release/bundle/macos/JURO.app
```

Build a Manjaro/Linux AppImage:

```bash
cd frontend
npm run tauri:build:manjaro
```

The AppImage is produced under:

```text
frontend/src-tauri/target/release/bundle/appimage/
```

Run the Manjaro build on a Linux machine with the normal Tauri Linux system dependencies installed, plus Node.js, npm, Rust, Cargo, and Java 17+.

The build process:

1. packages the Spring Boot backend jar
2. builds the React frontend with `VITE_API_BASE_URL=http://127.0.0.1:18191`
3. copies the backend jar into the Tauri app resources
4. creates the selected desktop bundle

Build the native executable without an app bundle:

```bash
cd frontend
npm run tauri -- build --no-bundle
```

## Verification Commands

Run backend tests:

```bash
cd backend
MAVEN_OPTS='-Djava.io.tmpdir=../.tmp' TMPDIR=../.tmp mvn -s ../.mvn/public-settings.xml -Dmaven.repo.local=../.m2repo test
```

Run the frontend production build used by Tauri:

```bash
cd frontend
npm run build:tauri
```

Build the desktop bundle:

```bash
cd frontend
npm run tauri -- build --bundles app
```

Build the Manjaro/Linux AppImage:

```bash
cd frontend
npm run tauri:build:manjaro
```

## Production Release Checklist

Before distributing JURO to other users:

- set final app name, version, identifier, and icon in `frontend/src-tauri/tauri.conf.json`
- decide whether to bundle a JRE or require users to install Java 17+
- create a signed macOS build
- notarize the app with Apple
- package the app as a `.dmg`
- document the first-run setup for VS Code, Java, and the optional AI provider
- add an update channel if automatic updates are needed

Current limitation: the app still expects Java 17+ to exist on the user machine. For the cleanest end-user install, the next production hardening step is bundling or installing a known Java runtime.

## Project Structure

```text
backend/
  Spring Boot API, Java scaffold generation, test running, AI evaluation,
  review scheduling, local settings, and persistence.

frontend/
  React + TypeScript UI, Problem Bank, Settings, Knowledge Check,
  local workspace controls, and Tauri desktop shell.

frontend/src-tauri/
  Tauri app configuration and Rust launcher that starts/stops the backend.
```

## Useful Local URLs

Desktop backend:

```text
http://127.0.0.1:18191
```

Common local AI endpoints:

```text
http://localhost:11434
http://127.0.0.1:11435/v1/
```
