import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { SettingItem } from "@mariozechner/pi-tui";
import { ZellijModal, ZellijSettingsModal } from "./zellij-modal.js";
import {
	detectToolDisplayPreset,
	getToolDisplayPresetConfig,
	parseToolDisplayPreset,
	TOOL_DISPLAY_PRESETS,
	type ToolDisplayPreset,
} from "./presets.js";
import { type ToolDisplayConfig } from "./types.js";

interface ToolDisplayConfigController {
	getConfig(): ToolDisplayConfig;
	setConfig(next: ToolDisplayConfig, ctx: ExtensionCommandContext): void;
}

interface SettingValueSyncTarget {
	updateValue(id: string, value: string): void;
}

const PREVIEW_LINE_VALUES = ["4", "8", "12", "20", "40"];
const EXPANDED_PREVIEW_MAX_LINE_VALUES = ["500", "1000", "2000", "4000", "8000", "12000", "20000"];
const BASH_PREVIEW_LINE_VALUES = ["0", "5", "10", "20", "40"];
const DIFF_SPLIT_MIN_WIDTH_VALUES = ["90", "100", "120", "140", "160"];
const DIFF_COLLAPSED_LINE_VALUES = ["8", "16", "24", "40", "80"];
const PRESET_COMMAND_HINT = TOOL_DISPLAY_PRESETS.join("|");

function toOnOff(value: boolean): string {
	return value ? "on" : "off";
}

function summarizeConfig(config: ToolDisplayConfig): string {
	const preset = detectToolDisplayPreset(config);
	return `preset=${preset}, read=${config.readOutputMode}, search=${config.searchOutputMode}, mcp=${config.mcpOutputMode}, preview=${config.previewLines}, expandedMax=${config.expandedPreviewMaxLines}, bash=${config.bashCollapsedLines}, diff=${config.diffViewMode}@${config.diffSplitMinWidth}, diffLines=${config.diffCollapsedLines}, diffWrap=${toOnOff(config.diffWordWrap)}, rtkHints=${toOnOff(config.showRtkCompactionHints)}`;
}

function parseNumber(value: string, fallback: number): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
}

function buildSettingItems(config: ToolDisplayConfig): SettingItem[] {
	return [
		{
			id: "preset",
			label: "Preset profile",
			description: "opencode = strict inline-only, balanced = compact summaries, verbose = line previews",
			currentValue: detectToolDisplayPreset(config),
			values: [...TOOL_DISPLAY_PRESETS],
		},
		{
			id: "readOutputMode",
			label: "Read tool output",
			description: "hidden = OpenCode style (path only), summary = line count, preview = show file lines",
			currentValue: config.readOutputMode,
			values: ["hidden", "summary", "preview"],
		},
		{
			id: "searchOutputMode",
			label: "Grep/Find/Ls output",
			description: "hidden = call only, count = match count, preview = show lines",
			currentValue: config.searchOutputMode,
			values: ["hidden", "count", "preview"],
		},
		{
			id: "mcpOutputMode",
			label: "MCP tool output",
			description: "hidden = call only, summary = line count, preview = show lines",
			currentValue: config.mcpOutputMode,
			values: ["hidden", "summary", "preview"],
		},
		{
			id: "previewLines",
			label: "Preview lines (read/search/MCP)",
			description: "Lines shown in collapsed mode when preview mode is enabled",
			currentValue: String(config.previewLines),
			values: PREVIEW_LINE_VALUES,
		},
		{
			id: "expandedPreviewMaxLines",
			label: "Expanded max lines (Ctrl+O)",
			description: "Safety ceiling for expanded read/search/MCP output rendering",
			currentValue: String(config.expandedPreviewMaxLines),
			values: EXPANDED_PREVIEW_MAX_LINE_VALUES,
		},
		{
			id: "bashCollapsedLines",
			label: "Bash collapsed lines",
			description: "OpenCode default is 10; set 0 to hide bash output when collapsed",
			currentValue: String(config.bashCollapsedLines),
			values: BASH_PREVIEW_LINE_VALUES,
		},
		{
			id: "diffViewMode",
			label: "Edit diff layout",
			description: "auto = adaptive, split = force side-by-side, unified = force single-column",
			currentValue: config.diffViewMode,
			values: ["auto", "split", "unified"],
		},
		{
			id: "diffSplitMinWidth",
			label: "Diff split min width",
			description: "Minimum terminal width required before side-by-side diff is used",
			currentValue: String(config.diffSplitMinWidth),
			values: DIFF_SPLIT_MIN_WIDTH_VALUES,
		},
		{
			id: "diffCollapsedLines",
			label: "Diff collapsed lines",
			description: "Maximum diff lines shown before expand (Ctrl+O)",
			currentValue: String(config.diffCollapsedLines),
			values: DIFF_COLLAPSED_LINE_VALUES,
		},
		{
			id: "diffWordWrap",
			label: "Diff word wrap",
			description: "Wrap long diff lines instead of clipping them",
			currentValue: toOnOff(config.diffWordWrap),
			values: ["on", "off"],
		},
		{
			id: "showTruncationHints",
			label: "Show truncation hints",
			description: "Shows notices when backend line/byte truncation happens",
			currentValue: toOnOff(config.showTruncationHints),
			values: ["on", "off"],
		},
		{
			id: "showRtkCompactionHints",
			label: "Show RTK compaction hints",
			description: "Shows RTK compaction labels (including summary suffix text)",
			currentValue: toOnOff(config.showRtkCompactionHints),
			values: ["on", "off"],
		},
	];
}

function applyPreset(preset: ToolDisplayPreset): ToolDisplayConfig {
	return getToolDisplayPresetConfig(preset);
}

function applySetting(config: ToolDisplayConfig, id: string, value: string): ToolDisplayConfig {
	switch (id) {
		case "preset": {
			const parsed = parseToolDisplayPreset(value);
			return parsed ? applyPreset(parsed) : config;
		}
		case "readOutputMode":
			return {
				...config,
				readOutputMode: value as ToolDisplayConfig["readOutputMode"],
			};
		case "searchOutputMode":
			return {
				...config,
				searchOutputMode: value as ToolDisplayConfig["searchOutputMode"],
			};
		case "mcpOutputMode":
			return {
				...config,
				mcpOutputMode: value as ToolDisplayConfig["mcpOutputMode"],
			};
		case "previewLines":
			return {
				...config,
				previewLines: parseNumber(value, config.previewLines),
			};
		case "expandedPreviewMaxLines":
			return {
				...config,
				expandedPreviewMaxLines: parseNumber(value, config.expandedPreviewMaxLines),
			};
		case "bashCollapsedLines":
			return {
				...config,
				bashCollapsedLines: parseNumber(value, config.bashCollapsedLines),
			};
		case "diffViewMode":
			return {
				...config,
				diffViewMode: value as ToolDisplayConfig["diffViewMode"],
			};
		case "diffSplitMinWidth":
			return {
				...config,
				diffSplitMinWidth: parseNumber(value, config.diffSplitMinWidth),
			};
		case "diffCollapsedLines":
			return {
				...config,
				diffCollapsedLines: parseNumber(value, config.diffCollapsedLines),
			};
		case "diffWordWrap":
			return {
				...config,
				diffWordWrap: value === "on",
			};
		case "showTruncationHints":
			return {
				...config,
				showTruncationHints: value === "on",
			};
		case "showRtkCompactionHints":
			return {
				...config,
				showRtkCompactionHints: value === "on",
			};
		default:
			return config;
	}
}

function syncSettingValues(settingsList: SettingValueSyncTarget, config: ToolDisplayConfig): void {
	settingsList.updateValue("preset", detectToolDisplayPreset(config));
	settingsList.updateValue("readOutputMode", config.readOutputMode);
	settingsList.updateValue("searchOutputMode", config.searchOutputMode);
	settingsList.updateValue("mcpOutputMode", config.mcpOutputMode);
	settingsList.updateValue("previewLines", String(config.previewLines));
	settingsList.updateValue("expandedPreviewMaxLines", String(config.expandedPreviewMaxLines));
	settingsList.updateValue("bashCollapsedLines", String(config.bashCollapsedLines));
	settingsList.updateValue("diffViewMode", config.diffViewMode);
	settingsList.updateValue("diffSplitMinWidth", String(config.diffSplitMinWidth));
	settingsList.updateValue("diffCollapsedLines", String(config.diffCollapsedLines));
	settingsList.updateValue("diffWordWrap", toOnOff(config.diffWordWrap));
	settingsList.updateValue("showTruncationHints", toOnOff(config.showTruncationHints));
	settingsList.updateValue("showRtkCompactionHints", toOnOff(config.showRtkCompactionHints));
}

async function openSettingsModal(ctx: ExtensionCommandContext, controller: ToolDisplayConfigController): Promise<void> {
	const overlayOptions = { anchor: "center" as const, width: 76, maxHeight: "80%" as const, margin: 1 };

	await ctx.ui.custom<void>(
		(tui, theme, _keybindings, done) => {
			let current = controller.getConfig();
			let settingsModal: ZellijSettingsModal | null = null;

			settingsModal = new ZellijSettingsModal(
				{
					title: "Tool Display Settings",
					description: "OpenCode-style tool output behavior for pi",
					settings: buildSettingItems(current),
					onChange: (id, newValue) => {
						current = applySetting(current, id, newValue);
						controller.setConfig(current, ctx);
						current = controller.getConfig();
						if (settingsModal) {
							syncSettingValues(settingsModal, current);
						}
					},
					onClose: () => done(),
					helpText: `/tool-display preset ${PRESET_COMMAND_HINT} • /tool-display show`,
					enableSearch: true,
				},
				theme,
			);

			const modal = new ZellijModal(
				settingsModal,
				{
					borderStyle: "rounded",
					titleBar: {
						left: "Tool Display Settings",
						right: "pi-tool-display",
					},
					helpUndertitle: {
						text: "Esc: close | ↑↓: navigate | Space: toggle",
						color: "dim",
					},
					overlay: overlayOptions,
				},
				theme,
			);

			return {
				render(width: number) {
					return modal.renderModal(width).lines;
				},
				invalidate() {
					modal.invalidate();
				},
				handleInput(data: string) {
					modal.handleInput(data);
					tui.requestRender();
				},
			};
		},
		{ overlay: true, overlayOptions },
	);
}

function handleToolDisplayArgs(args: string, ctx: ExtensionCommandContext, controller: ToolDisplayConfigController): boolean {
	const raw = args.trim();
	if (!raw) {
		return false;
	}

	const normalized = raw.toLowerCase();

	if (normalized === "show") {
		ctx.ui.notify(`tool-display: ${summarizeConfig(controller.getConfig())}`, "info");
		return true;
	}

	if (normalized === "reset") {
		controller.setConfig(getToolDisplayPresetConfig("opencode"), ctx);
		ctx.ui.notify("Tool display preset reset to opencode.", "info");
		return true;
	}

	if (normalized.startsWith("preset ")) {
		const candidate = normalized.slice("preset ".length).trim();
		const preset = parseToolDisplayPreset(candidate);
		if (!preset) {
			ctx.ui.notify(`Unknown preset. Use: /tool-display preset ${PRESET_COMMAND_HINT}`, "warning");
			return true;
		}

		controller.setConfig(getToolDisplayPresetConfig(preset), ctx);
		ctx.ui.notify(`Tool display preset set to ${preset}.`, "info");
		return true;
	}


	ctx.ui.notify(`Usage: /tool-display [show|reset|preset ${PRESET_COMMAND_HINT}]`, "warning");
	return true;
}

export function registerToolDisplayCommand(pi: ExtensionAPI, controller: ToolDisplayConfigController): void {
	pi.registerCommand("tool-display", {
		description: "Configure tool output rendering (OpenCode-style)",
		handler: async (args, ctx) => {
			if (handleToolDisplayArgs(args, ctx, controller)) {
				return;
			}

			if (!ctx.hasUI) {
				ctx.ui.notify("/tool-display requires interactive TUI mode.", "warning");
				return;
			}

			await openSettingsModal(ctx, controller);
		},
	});
}
