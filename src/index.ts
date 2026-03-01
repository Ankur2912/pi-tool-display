import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@mariozechner/pi-coding-agent";
import {
  loadToolDisplayConfig,
  normalizeToolDisplayConfig,
  saveToolDisplayConfig,
} from "./config-store.js";
import { registerToolDisplayCommand } from "./config-modal.js";
import { registerToolDisplayOverrides } from "./tool-overrides.js";
import registerNativeUserMessageBox from "./user-message-box-native.js";
import type { ToolDisplayConfig } from "./types.js";

export default function toolDisplayExtension(pi: ExtensionAPI): void {
  const initial = loadToolDisplayConfig();
  let config: ToolDisplayConfig = initial.config;
  let pendingLoadError = initial.error;

  const getConfig = (): ToolDisplayConfig => config;

  const setConfig = (
    next: ToolDisplayConfig,
    ctx: ExtensionCommandContext,
  ): void => {
    const normalized = normalizeToolDisplayConfig(next);
    config = normalized;

    const saved = saveToolDisplayConfig(normalized);
    if (!saved.success && saved.error) {
      ctx.ui.notify(saved.error, "error");
    }
  };

  registerToolDisplayOverrides(pi, getConfig);
  registerNativeUserMessageBox(pi);
  registerToolDisplayCommand(pi, { getConfig, setConfig });

  pi.on("session_start", async (_event, ctx) => {
    if (pendingLoadError) {
      ctx.ui.notify(pendingLoadError, "warning");
      pendingLoadError = undefined;
    }
  });
}
