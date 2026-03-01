import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	DEFAULT_TOOL_DISPLAY_CONFIG,
	type ConfigLoadResult,
	type ConfigSaveResult,
	DIFF_VIEW_MODES,
	MCP_OUTPUT_MODES,
	READ_OUTPUT_MODES,
	SEARCH_OUTPUT_MODES,
	type ToolDisplayConfig,
} from "./types.js";

const CONFIG_DIR = join(homedir(), ".pi", "agent", "extensions", "pi-tool-display");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== "number" || Number.isNaN(value)) {
		return fallback;
	}
	const rounded = Math.floor(value);
	if (rounded < min) return min;
	if (rounded > max) return max;
	return rounded;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function toReadOutputMode(value: unknown): ToolDisplayConfig["readOutputMode"] {
	return READ_OUTPUT_MODES.includes(value as ToolDisplayConfig["readOutputMode"])
		? (value as ToolDisplayConfig["readOutputMode"])
		: DEFAULT_TOOL_DISPLAY_CONFIG.readOutputMode;
}

function toSearchOutputMode(value: unknown): ToolDisplayConfig["searchOutputMode"] {
	return SEARCH_OUTPUT_MODES.includes(value as ToolDisplayConfig["searchOutputMode"])
		? (value as ToolDisplayConfig["searchOutputMode"])
		: DEFAULT_TOOL_DISPLAY_CONFIG.searchOutputMode;
}

function toMcpOutputMode(value: unknown): ToolDisplayConfig["mcpOutputMode"] {
	return MCP_OUTPUT_MODES.includes(value as ToolDisplayConfig["mcpOutputMode"])
		? (value as ToolDisplayConfig["mcpOutputMode"])
		: DEFAULT_TOOL_DISPLAY_CONFIG.mcpOutputMode;
}

function toDiffViewMode(value: unknown): ToolDisplayConfig["diffViewMode"] {
	if (value === "stacked") {
		// Backward compatibility with older config naming.
		return "unified";
	}

	return DIFF_VIEW_MODES.includes(value as ToolDisplayConfig["diffViewMode"])
		? (value as ToolDisplayConfig["diffViewMode"])
		: DEFAULT_TOOL_DISPLAY_CONFIG.diffViewMode;
}

export function normalizeToolDisplayConfig(raw: unknown): ToolDisplayConfig {
	const source = typeof raw === "object" && raw !== null ? (raw as Partial<ToolDisplayConfig>) : {};

	return {
		readOutputMode: toReadOutputMode(source.readOutputMode),
		searchOutputMode: toSearchOutputMode(source.searchOutputMode),
		mcpOutputMode: toMcpOutputMode(source.mcpOutputMode),
		previewLines: clampNumber(source.previewLines, 1, 80, DEFAULT_TOOL_DISPLAY_CONFIG.previewLines),
		expandedPreviewMaxLines: clampNumber(
			source.expandedPreviewMaxLines,
			0,
			20_000,
			DEFAULT_TOOL_DISPLAY_CONFIG.expandedPreviewMaxLines,
		),
		bashCollapsedLines: clampNumber(source.bashCollapsedLines, 0, 80, DEFAULT_TOOL_DISPLAY_CONFIG.bashCollapsedLines),
		diffViewMode: toDiffViewMode(source.diffViewMode),
		diffSplitMinWidth: clampNumber(source.diffSplitMinWidth, 70, 240, DEFAULT_TOOL_DISPLAY_CONFIG.diffSplitMinWidth),
		diffCollapsedLines: clampNumber(source.diffCollapsedLines, 4, 240, DEFAULT_TOOL_DISPLAY_CONFIG.diffCollapsedLines),
		diffWordWrap: toBoolean(source.diffWordWrap, DEFAULT_TOOL_DISPLAY_CONFIG.diffWordWrap),
		showTruncationHints: toBoolean(source.showTruncationHints, DEFAULT_TOOL_DISPLAY_CONFIG.showTruncationHints),
		showRtkCompactionHints: toBoolean(
			source.showRtkCompactionHints,
			DEFAULT_TOOL_DISPLAY_CONFIG.showRtkCompactionHints,
		),
	};
}

export function loadToolDisplayConfig(): ConfigLoadResult {
	if (!existsSync(CONFIG_FILE)) {
		return { config: { ...DEFAULT_TOOL_DISPLAY_CONFIG } };
	}

	try {
		const rawText = readFileSync(CONFIG_FILE, "utf-8");
		const rawConfig = JSON.parse(rawText) as unknown;
		return { config: normalizeToolDisplayConfig(rawConfig) };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			config: { ...DEFAULT_TOOL_DISPLAY_CONFIG },
			error: `Failed to parse ${CONFIG_FILE}: ${message}`,
		};
	}
}

export function saveToolDisplayConfig(config: ToolDisplayConfig): ConfigSaveResult {
	const normalized = normalizeToolDisplayConfig(config);
	const tmpFile = `${CONFIG_FILE}.tmp`;

	try {
		mkdirSync(CONFIG_DIR, { recursive: true });
		writeFileSync(tmpFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
		renameSync(tmpFile, CONFIG_FILE);
		return { success: true };
	} catch (error) {
		try {
			if (existsSync(tmpFile)) {
				unlinkSync(tmpFile);
			}
		} catch {
			// Ignore cleanup errors.
		}
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			error: `Failed to save ${CONFIG_FILE}: ${message}`,
		};
	}
}

export function getToolDisplayConfigPath(): string {
	return CONFIG_FILE;
}
