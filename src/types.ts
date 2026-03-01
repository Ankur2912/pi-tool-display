export const READ_OUTPUT_MODES = ["hidden", "summary", "preview"] as const;
export const SEARCH_OUTPUT_MODES = ["hidden", "count", "preview"] as const;
export const MCP_OUTPUT_MODES = ["hidden", "summary", "preview"] as const;
export const DIFF_VIEW_MODES = ["auto", "split", "unified"] as const;

export type ReadOutputMode = (typeof READ_OUTPUT_MODES)[number];
export type SearchOutputMode = (typeof SEARCH_OUTPUT_MODES)[number];
export type McpOutputMode = (typeof MCP_OUTPUT_MODES)[number];
export type DiffViewMode = (typeof DIFF_VIEW_MODES)[number];

export interface ToolDisplayConfig {
	readOutputMode: ReadOutputMode;
	searchOutputMode: SearchOutputMode;
	mcpOutputMode: McpOutputMode;
	previewLines: number;
	expandedPreviewMaxLines: number;
	bashCollapsedLines: number;
	diffViewMode: DiffViewMode;
	diffSplitMinWidth: number;
	diffCollapsedLines: number;
	diffWordWrap: boolean;
	showTruncationHints: boolean;
	showRtkCompactionHints: boolean;
}

export const DEFAULT_TOOL_DISPLAY_CONFIG: ToolDisplayConfig = {
	readOutputMode: "hidden",
	searchOutputMode: "hidden",
	mcpOutputMode: "hidden",
	previewLines: 8,
	expandedPreviewMaxLines: 4000,
	bashCollapsedLines: 10,
	diffViewMode: "auto",
	diffSplitMinWidth: 120,
	diffCollapsedLines: 24,
	diffWordWrap: true,
	showTruncationHints: true,
	showRtkCompactionHints: true,
};

export interface ConfigLoadResult {
	config: ToolDisplayConfig;
	error?: string;
}

export interface ConfigSaveResult {
	success: boolean;
	error?: string;
}
