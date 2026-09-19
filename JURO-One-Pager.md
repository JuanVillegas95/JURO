# JURO — Project Summary

**A local desktop app for deliberate Java coding practice, built as a year-long corporate initiative.**

---

## The Problem

Existing coding-practice tools (LeetCode, HackerRank, etc.) have three gaps that make them insufficient for systematic skill-building:

1. **No spaced repetition.** Problems are not revisited at optimal intervals. Hard problems fade.
2. **Code without understanding.** Passing tests doesn't mean you can explain the algorithm, its complexity, or its edge cases. Interviews require both.
3. **Not your toolchain.** You practice in a browser IDE you'll never use in production. Real fluency comes from your editor, your shortcuts, your workflow.

---

## What JURO Does

JURO owns the study system while your editor and Claude do the coaching.

**It maintains a local problem bank** — stored in a SQLite file managed by the Fastify server — and lets you open any problem as a real Maven Java project in VS Code or Neovim. You solve it in your editor. JURO runs the JUnit tests and records the result.

**It grades your explanation.** After solving, Claude asks questions through JURO's local MCP server and returns structured feedback for your spoken or written explanation.

**It schedules future reviews** for both coding and explanation separately, using the SM-2 spaced-repetition algorithm. Problems resurface when you're most likely to have forgotten just enough that reviewing strengthens retention.

**It provides controlled problem administration.** A separate local MCP server exposes validated list, create, update, and delete tools backed by SQLite. The learner application has no problem-editing controls and no JSON file-import workflow.

---

## Key Features

| Feature | Detail |
|---|---|
| Problem bank | SQLite-backed storage, rich metadata, MCP administration |
| Coding review | Real Java scaffold, VS Code / Neovim integration, JUnit runner |
| Explanation review | Text or speech input, AI grading against rubric |
| Coaching | Claude through the local MCP server |
| Spaced repetition | SM-2 algorithm, separate tracks for coding and explanation |
| Problem administration | Separate local MCP server with validated database tools |
| Storage | Local SQLite file with WAL |

---

## Tech Stack

**Server:** Node.js 22 · Fastify · TypeScript · SQLite  
**Frontend:** React · TypeScript · Vite · Tailwind CSS  
**Local tooling:** Java 17 · Maven · VS Code / Neovim  
**Coaching integration:** Claude via MCP  

---

## How to Run

```bash
# Install dependencies
npm run install:all

# Run the Fastify API and Vite frontend
npm run dev
```

**Requirements:** Java 17+, Node.js 22+, Rust/Cargo, VS Code or Neovim on PATH.

---

## Project Structure

```
server/      Fastify API, SQLite persistence, scaffold generation,
             test running, review scheduling, MCP
frontend/    React + TypeScript UI
```

---

*Built in 2025–2026 as a corporate internal tool for Java interview preparation and systematic skill development.*
