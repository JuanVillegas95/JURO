import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SettingsStore } from "../src/settings.js";

test("settings persist custom editor and tool paths", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "juro-settings-test-"));
  try {
    const store = new SettingsStore(path.join(directory, "settings.properties"));
    const saved = store.save({ editor: "VS_CODE", editorPath: "/custom/code", nodePath: "/custom/node" });
    const loaded = new SettingsStore(path.join(directory, "settings.properties")).get();

    assert.equal(saved.editorPath, "/custom/code");
    assert.equal(loaded.editorPath, "/custom/code");
    assert.equal(loaded.nodePath, "/custom/node");
    assert.equal(loaded.pythonPath, "");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("settings reject line breaks in executable paths", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "juro-settings-invalid-"));
  try {
    const store = new SettingsStore(path.join(directory, "settings.properties"));
    assert.throws(() => store.save({ nodePath: "/custom/node\n--bad" }), /cannot contain line breaks/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
