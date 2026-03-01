import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { SettingItem } from "@mariozechner/pi-tui";
import { ZellijModal, ZellijSettingsModal } from "./zellij-modal.js";
import type { ToolDisplayCapabilities } from "./capabilities.js";
import {
	detectToolDisplayPreset,
	getToolDisplayPresetConfig,
	parseToolDisplayPreset,
	TOOL_DISPLAY_PRESETS,
	type ToolDisplayPreset,
} from "./presets.js";
import {
	BUILT_IN_TOOL_OVERRIDE_NAMES,
	type BuiltInToolOverrideName,
	type ToolDisplayConfig,
} from "./types.js";

interface ToolDisplayConfigController {
	getConfig(): ToolDisplayConfig;
	setConfig(next: ToolDisplayConfig, ctx: ExtensionCommandContext): void;
	getCapabilities(): ToolDisplayCapabilities;
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

const TOOL_OVERRIDE_SETTING_IDS: Record<BuiltInToolOverrideName, string> = {
	read: "registerToolOverrides.read",
	grep: "registerToolOverrides.grep",
	find: "registerToolOverrides.find",
	ls: "registerToolOverrides.ls",
	bash: "registerToolOverrides.bash",
	edit: "registerToolOverrides.edit",
	write: "registerToolOverrides.write",
};

function toOnOff(value: boolean): string {
	return value ? "on" : "off";
}

function toolOwnershipSummary(config: ToolDisplayConfig): string {
	const overrides = config.registerToolOverrides;
	return `read:${toOnOff(overrides.read)},grep:${toOnOff(overrides.grep)},find:${toOnOff(overrides.find)},ls:${toOnOff(overrides.ls)},bash:${toOnOff(overrides.bash)},edit:${toOnOff(overrides.edit)},write:${toOnOff(overrides.write)}`;
}

function summarizeConfig(config: ToolDisplayConfig, capabilities: ToolDisplayCapabilities): string {
	const preset = detectToolDisplayPreset(config);
	const parts = [
		`preset=${preset}`,
		`owners={${toolOwnershipSummary(config)}}`,
		`userBox=${toOnOff(config.enableNativeUserMessageBox)}`,
		`read=${config.readOutputMode}`,
		`search=${config.searchOutputMode}`,
		`preview=${config.previewLines}`,
		`expandedMax=${config.expandedPreviewMaxLines}`,
		`bash=${config.bashCollapsedLines}`,
		`diff=${config.diffViewMode}@${config.diffSplitMinWidth}`,
		`diffLines=${config.diffCollapsedLines}`,
		`diffWrap=${toOnOff(config.diffWordWrap)}`,
	];

	if (capabilities.hasMcpTooling) {
		parts.push(`mcp=${config.mcpOutputMode}`);
	} else {
		parts.push("mcp=auto-hidden");
	}

	if (capabilities.hasRtkOptimizer) {
		parts.push(`rtkHints=${toOnOff(config.showRtkCompactionHints)}`);
	} else {
		parts.push("rtkHints=auto-off");
	}

	return parts.join(", ");
}

function parseNumber(value: string, fallback: number): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
}

function buildToolOwnershipSettings(config: ToolDisplayConfig): SettingItem[] {
	return [
		{
			id: TOOL_OVERRIDE_SETTING_IDS.read,
			label: "Own read tool override",
			description: "on = pi-tool-display owns read, off = leave read for another extension (applies after /reload)",
			currentValue: toOnOff(config.registerToolOverrides.read),
			values: ["on", "off"],
		},
		{
			id: TOOL_OVERRIDE_SETTING_IDS.grep,
			label: "Own grep tool override",
			description: "on = pi-tool-display owns grep (applies after /reload)",
			currentValue: toOnOff(config.registerToolOverrides.grep),
			values: ["on", "off"],
		},
		{
			id: TOOL_OVERRIDE_SETTING_IDS.find,
			label: "Own find tool override",
			description: "on = pi-tool-display owns find (applies after /reload)",
			currentValue: toOnOff(config.registerToolOverrides.find),
			values: ["on", "off"],
		},
		{
			id: TOOL_OVERRIDE_SETTING_IDS.ls,
			label: "Own ls tool override",
			description: "on = pi-tool-display owns ls (applies after /reload)",
			currentValue: toOnOff(config.registerToolOverrides.ls),
			values: ["on", "off"],
		},
		{
			id: TOOL_OVERRIDE_SETTING_IDS.bash,
			label: "Own bash tool override",
			description: "on = pi-tool-display owns bash (applies after /reload)",
			currentValue: toOnOff(config.registerToolOverrides.bash),
			values: ["on", "off"],
		},
		{
			id: TOOL_OVERRIDE_SETTING_IDS.edit,
			label: "Own edit tool override",
			description: "on = pi-tool-display owns edit (applies after /reload)",
			currentValue: toOnOff(config.registerToolOverrides.edit),
			values: ["on", "off"],
		},
		{
			id: TOOL_OVERRIDE_SETTING_IDS.write,
			label: "Own write tool override",
			description: "on = pi-tool-display owns write (applies after /reload)",
			currentValue: toOnOff(config.registerToolOverrides.write),
			values: ["on", "off"],
		},
	];
}

function buildSettingItems(
	config: ToolDisplayConfig,
	capabilities: ToolDisplayCapabilities,
): SettingItem[] {
	const mcpSettings: SettingItem[] = capabilities.hasMcpTooling
		? [
				{
					id: "mcpOutputMode",
					label: "MCP tool output",
					description: "hidden = call only, summary = line count, preview = show lines",
					currentValue: config.mcpOutputMode,
					values: ["hidden", "summary", "preview"],
				},
			]
		: [];

	const rtkSettings: SettingItem[] = capabilities.hasRtkOptimizer
		? [
				{
					id: "showRtkCompactionHints",
					label: "Show RTK compaction hints",
					description: "Shows RTK compaction labels (including summary suffix text)",
					currentValue: toOnOff(config.showRtkCompactionHints),
					values: ["on", "off"],
				},
			]
		: [];

	return [
		{
			id: "preset",
			label: "Preset profile",
			description: "opencode = strict inline-only, balanced = compact summaries, verbose = line previews",
			currentValue: detectToolDisplayPreset(config),
			values: [...TOOL_DISPLAY_PRESETS],
		},
		{
			id: "enableNativeUserMessageBox",
			label: "Native user message box",
			description: "on = render user prompts in bordered box, off = use default Pi user message rendering",
			currentValue: toOnOff(config.enableNativeUserMessageBox),
			values: ["on", "off"],
		},
		...buildToolOwnershipSettings(config),
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
		...mcpSettings,
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
		...rtkSettings,
	];
}

function applyPreset(preset: ToolDisplayPreset): ToolDisplayConfig {
	return getToolDisplayPresetConfig(preset);
}

function parseToolOverrideSettingId(id: string): BuiltInToolOverrideName | undefined {
	for (const toolName of BUILT_IN_TOOL_OVERRIDE_NAMES) {
		if (TOOL_OVERRIDE_SETTING_IDS[toolName] === id) {
			return toolName;
		}
	}
	return undefined;
}

function withToolOverride(
	config: ToolDisplayConfig,
	toolName: BuiltInToolOverrideName,
	enabled: boolean,
): ToolDisplayConfig {
	const registerToolOverrides: ToolDisplayConfig["registerToolOverrides"] = {
		...config.registerToolOverrides,
		[toolName]: enabled,
	};
	return {
		...config,
		registerToolOverrides,
	};
}

function applySetting(config: ToolDisplayConfig, id: string, value: string): ToolDisplayConfig {
	switch (id) {
		case "preset": {
			const parsed = parseToolDisplayPreset(value);
			return parsed ? applyPreset(parsed) : config;
		}
		case "enableNativeUserMessageBox":
			return {
				...config,
				enableNativeUserMessageBox: value === "on",
			};
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
		default: {
			const toolName = parseToolOverrideSettingId(id);
			if (toolName) {
				return withToolOverride(config, toolName, value === "on");
			}
			return config;
		}
	}
}

function syncSettingValues(
	settingsList: SettingValueSyncTarget,
	config: ToolDisplayConfig,
	capabilities: ToolDisplayCapabilities,
): void {
	settingsList.updateValue("preset", detectToolDisplayPreset(config));
	settingsList.updateValue("enableNativeUserMessageBox", toOnOff(config.enableNativeUserMessageBox));
	for (const toolName of BUILT_IN_TOOL_OVERRIDE_NAMES) {
		settingsList.updateValue(TOOL_OVERRIDE_SETTING_IDS[toolName], toOnOff(config.registerToolOverrides[toolName]));
	}
	settingsList.updateValue("readOutputMode", config.readOutputMode);
	settingsList.updateValue("searchOutputMode", config.searchOutputMode);
	if (capabilities.hasMcpTooling) {
		settingsList.updateValue("mcpOutputMode", config.mcpOutputMode);
	}
	settingsList.updateValue("previewLines", String(config.previewLines));
	settingsList.updateValue("expandedPreviewMaxLines", String(config.expandedPreviewMaxLines));
	settingsList.updateValue("bashCollapsedLines", String(config.bashCollapsedLines));
	settingsList.updateValue("diffViewMode", config.diffViewMode);
	settingsList.updateValue("diffSplitMinWidth", String(config.diffSplitMinWidth));
	settingsList.updateValue("diffCollapsedLines", String(config.diffCollapsedLines));
	settingsList.updateValue("diffWordWrap", toOnOff(config.diffWordWrap));
	settingsList.updateValue("showTruncationHints", toOnOff(config.showTruncationHints));
	if (capabilities.hasRtkOptimizer) {
		settingsList.updateValue("showRtkCompactionHints", toOnOff(config.showRtkCompactionHints));
	}
}

async function openSettingsModal(ctx: ExtensionCommandContext, controller: ToolDisplayConfigController): Promise<void> {
	const overlayOptions = { anchor: "center" as const, width: 76, maxHeight: "80%" as const, margin: 1 };
	const capabilities = controller.getCapabilities();

	await ctx.ui.custom<void>(
		(tui, theme, _keybindings, done) => {
			let current = controller.getConfig();
			let settingsModal: ZellijSettingsModal | null = null;

			settingsModal = new ZellijSettingsModal(
				{
					title: "Tool Display Settings",
					description: "OpenCode-style tool output behavior for pi",
					settings: buildSettingItems(current, capabilities),
					onChange: (id, newValue) => {
						current = applySetting(current, id, newValue);
						controller.setConfig(current, ctx);
						current = controller.getConfig();
						if (settingsModal) {
							syncSettingValues(settingsModal, current, capabilities);
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
		ctx.ui.notify(
			`tool-display: ${summarizeConfig(controller.getConfig(), controller.getCapabilities())}`,
			"info",
		);
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
