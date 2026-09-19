# JURO

JURO is a small, local coding-practice app for building problem-solving habits.

It helps you:

- Pick a problem for today.
- Open its workspace in VS Code or Neovim.
- Run tests in Java, Python, JavaScript, or Go.
- Explain your approach through Claude and check your understanding.
- Track attempts, results, time, review grades, and progress.
- Schedule the next review instead of starting from zero every time.

The app is intentionally local. Your problems and progress live in SQLite on your computer. Claude connects through JURO's local MCP server, so JURO does not store a provider URL or API key.

## A normal session

1. Start the problem.
2. Open the editor.
3. Write your solution and run the tests.
4. Explain the approach to Claude.
5. Grade the session and schedule the next review.

## Run JURO

From the project folder:

```sh
npm run install:all
npm run juro
```

Then open `http://127.0.0.1:3000` if it does not open automatically.

For development with Vite:

```sh
npm run dev
```

To run the local runner checks:

```sh
npm --prefix server test
```

## Local data

- Database: `.data/juro.sqlite`
- Settings: `~/.juro/settings.properties`
- Problem workspaces: `~/juro-workspace`
- Backups: available from Settings

JURO needs Node.js 22. Java, Python, Node.js, and Go are checked locally when the app starts. Maven is optional for Java workflows.

If an editor or compiler is not found, open Settings and enter its command name or absolute executable path. Blank means automatic detection.
