import { spawn } from "node:child_process";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = resolve(scriptDirectory, "..");
const tempDirectory = resolve(frontendDirectory, "../.tmp");
const backendJar = resolve(frontendDirectory, "../backend/target/juro-backend-0.0.1-SNAPSHOT.jar");

try {
  await run("npm", ["run", "backend:package"]);

  const backendPort = process.env.JURO_BACKEND_PORT ?? String(await findOpenPort(18191));
  const frontendPort = process.env.JURO_FRONTEND_PORT ?? String(await findOpenPort(5180));
  const tauriConfig = JSON.stringify({
    build: {
      devUrl: `http://127.0.0.1:${frontendPort}`,
    },
    bundle: {
      resources: {
        [backendJar]: "backend/juro-backend.jar",
      },
    },
  });

  console.log(`Starting JURO dev with frontend ${frontendPort} and backend ${backendPort}.`);

  await run("tauri", ["dev"], {
    env: {
      ...process.env,
      JURO_BACKEND_PORT: backendPort,
      JURO_FRONTEND_PORT: frontendPort,
      TAURI_CONFIG: tauriConfig,
      TMPDIR: tempDirectory,
    },
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("SIGINT") && !message.includes("SIGTERM")) {
    console.error(message);
  }
  process.exitCode = 1;
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: frontendDirectory,
      env: options.env ?? process.env,
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    const forwardSignal = (signal) => {
      if (!child.killed) {
        child.kill(signal);
      }
    };
    process.once("SIGINT", forwardSignal);
    process.once("SIGTERM", forwardSignal);

    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      process.removeListener("SIGINT", forwardSignal);
      process.removeListener("SIGTERM", forwardSignal);

      if (code === 0) {
        resolveRun();
        return;
      }

      if (signal) {
        rejectRun(new Error(`${command} exited from ${signal}.`));
        return;
      }

      rejectRun(new Error(`${command} exited with code ${code}.`));
    });
  });
}

async function findOpenPort(preferredPort) {
  for (let port = preferredPort; port < preferredPort + 200; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`Unable to find an open port starting at ${preferredPort}.`);
}

function isPortAvailable(port) {
  return new Promise((resolveAvailability) => {
    const server = net.createServer();
    server.once("error", () => resolveAvailability(false));
    server.once("listening", () => {
      server.close(() => resolveAvailability(true));
    });
    server.listen(port, "127.0.0.1");
  });
}
