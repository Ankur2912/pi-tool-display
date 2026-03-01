import { DEFAULT_TOOL_DISPLAY_CONFIG, type ToolDisplayConfig } from "./types.js";

export const TOOL_DISPLAY_PRESETS = ["opencode", "balanced", "verbose"] as const;
export type ToolDisplayPreset = (typeof TOOL_DISPLAY_PRESETS)[number];

const TOOL_DISPLAY_PRESET_CONFIGS: Record<ToolDisplayPreset, ToolDisplayConfig> = {
	opencode: { ...DEFAULT_TOOL_DISPLAY_CONFIG },
	balanced: {
		...DEFAULT_TOOL_DISPLAY_CONFIG,
		readOutputMode: "summary",
		searchOutputMode: "count",
		mcpOutputMode: "summary",
	},
	verbose: {
		...DEFAULT_TOOL_DISPLAY_CONFIG,
		readOutputMode: "preview",
		searchOutputMode: "preview",
		mcpOutputMode: "preview",
		previewLines: 12,
		bashCollapsedLines: 20,
	},
};

function configsEqual(a: ToolDisplayConfig, b: ToolDisplayConfig): boolean {
	return (
		a.readOutputMode === b.readOutputMode &&
		a.searchOutputMode === b.searchOutputMode &&
		a.mcpOutputMode === b.mcpOutputMode &&
		a.previewLines === b.previewLines &&
		a.expandedPreviewMaxLines === b.expandedPreviewMaxLines &&
		a.bashCollapsedLines === b.bashCollapsedLines &&
		a.diffViewMode === b.diffViewMode &&
		a.diffSplitMinWidth === b.diffSplitMinWidth &&
		a.diffCollapsedLines === b.diffCollapsedLines &&
		a.diffWordWrap === b.diffWordWrap &&
		a.showTruncationHints === b.showTruncationHints &&
		a.showRtkCompactionHints === b.showRtkCompactionHints
	);
}

export function getToolDisplayPresetConfig(preset: ToolDisplayPreset): ToolDisplayConfig {
	return { ...TOOL_DISPLAY_PRESET_CONFIGS[preset] };
}

export function detectToolDisplayPreset(config: ToolDisplayConfig): ToolDisplayPreset | "custom" {
	for (const preset of TOOL_DISPLAY_PRESETS) {
		if (configsEqual(config, TOOL_DISPLAY_PRESET_CONFIGS[preset])) {
			return preset;
		}
	}
	return "custom";
}

export function parseToolDisplayPreset(raw: string): ToolDisplayPreset | undefined {
	const normalized = raw.trim().toLowerCase();
	if (!normalized) {
		return undefined;
	}
	return TOOL_DISPLAY_PRESETS.find((preset) => preset === normalized);
}
