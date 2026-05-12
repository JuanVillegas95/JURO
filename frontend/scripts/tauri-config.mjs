import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = resolve(scriptDirectory, "..");
const backendJar = resolve(frontendDirectory, "../backend/target/juro-backend-0.0.1-SNAPSHOT.jar");
const frontendPort = process.env.JURO_FRONTEND_PORT;

const config = {
  bundle: {
    resources: {
      [backendJar]: "backend/juro-backend.jar",
    },
  },
};

if (frontendPort) {
  config.build = {
    devUrl: `http://127.0.0.1:${frontendPort}`,
  };
}

process.stdout.write(JSON.stringify(config));
