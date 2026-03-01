import {
  type ExtensionAPI,
  UserMessageComponent,
} from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { sanitizeAnsiForThemedOutput } from "./render-utils.js";
import type { ToolDisplayConfig } from "./types.js";

interface ThemeLike {
  fg(color: string, text: string): string;
  bg?(color: string, text: string): string;
  bold?(text: string): string;
}

type UserMessageRenderFn = (width: number) => string[];

type UserMessagePrototype = {
  render: UserMessageRenderFn;
  __piUserMessageOriginalRender?: UserMessageRenderFn;
  __piUserMessageNativePatched?: boolean;
};

const MIN_BORDER_WIDTH = 8;
const TITLE_TEXT = " user ";
const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/g;

function colorBorder(theme: ThemeLike | undefined, text: string): string {
  if (!text) {
    return text;
  }

  if (!theme) {
    return text;
  }

  try {
    return theme.fg("border", text);
  } catch {
    return text;
  }
}

function colorTitle(theme: ThemeLike | undefined, title: string): string {
  if (!title) {
    return title;
  }

  const base = theme?.bold ? theme.bold(title) : title;
  if (!theme) {
    return base;
  }

  try {
    return theme.fg("accent", base);
  } catch {
    return base;
  }
}

function colorUserBackground(
  theme: ThemeLike | undefined,
  text: string,
): string {
  if (!text) {
    return text;
  }

  if (!theme || typeof theme.bg !== "function") {
    return text;
  }

  try {
    return theme.bg("userMessageBg", sanitizeAnsiForThemedOutput(text));
  } catch {
    return text;
  }
}

function isVisuallyEmptyLine(line: string): boolean {
  const withoutAnsi = line.replace(ANSI_ESCAPE_PATTERN, "");
  return withoutAnsi.trim().length === 0;
}

function normalizeVerticalPadding(lines: string[]): string[] {
  if (lines.length === 0) {
    return lines;
  }

  let leading = 0;
  while (leading < lines.length && isVisuallyEmptyLine(lines[leading] ?? "")) {
    leading++;
  }

  let trailing = 0;
  while (
    trailing < lines.length - leading &&
    isVisuallyEmptyLine(lines[lines.length - 1 - trailing] ?? "")
  ) {
    trailing++;
  }

  if (leading === trailing) {
    return lines;
  }

  const middleStart = leading;
  const middleEnd = Math.max(middleStart, lines.length - trailing);
  const middle = lines.slice(middleStart, middleEnd);

  if (middle.length === 0) {
    return lines;
  }

  const hasAnyEdgePadding = leading > 0 || trailing > 0;
  const symmetricPadding = hasAnyEdgePadding ? 1 : 0;

  return [
    ...Array.from({ length: symmetricPadding }, () => ""),
    ...middle,
    ...Array.from({ length: symmetricPadding }, () => ""),
  ];
}

function buildTopBorder(
  totalWidth: number,
  theme: ThemeLike | undefined,
): string {
  const innerWidth = Math.max(0, totalWidth - 2);
  const title = truncateToWidth(TITLE_TEXT, innerWidth, "");
  const fill = "─".repeat(Math.max(0, innerWidth - visibleWidth(title)));

  const row = `${colorBorder(theme, "╭")}${colorTitle(theme, title)}${colorBorder(theme, `${fill}╮`)}`;
  return colorUserBackground(theme, row);
}

function buildBottomBorder(
  totalWidth: number,
  theme: ThemeLike | undefined,
): string {
  const innerWidth = Math.max(0, totalWidth - 2);
  const row = `${colorBorder(theme, "╰")}${colorBorder(theme, `${"─".repeat(innerWidth)}╯`)}`;
  return colorUserBackground(theme, row);
}

function wrapContentLine(
  line: string,
  totalWidth: number,
  theme: ThemeLike | undefined,
): string {
  const innerWidth = Math.max(1, totalWidth - 2);
  const sanitizedLine = sanitizeAnsiForThemedOutput(line);
  const content = truncateToWidth(sanitizedLine, innerWidth, "", true);
  const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(content)));
  const row = `${colorBorder(theme, "│")}${content}${padding}${colorBorder(theme, "│")}`;
  return colorUserBackground(theme, row);
}

function patchUserMessageRender(
  getTheme: () => ThemeLike | undefined,
  isEnabled: () => boolean,
): void {
  const prototype =
    UserMessageComponent.prototype as unknown as UserMessagePrototype;
  if (typeof prototype.render !== "function") {
    return;
  }

  if (prototype.__piUserMessageNativePatched) {
    return;
  }

  if (!prototype.__piUserMessageOriginalRender) {
    prototype.__piUserMessageOriginalRender = prototype.render;
  }

  prototype.render = function renderWithZellijUserBorder(
    width: number,
  ): string[] {
    const originalRender = prototype.__piUserMessageOriginalRender;
    if (!originalRender) {
      return [];
    }

    const safeWidth = Math.max(0, Math.floor(width));
    if (!isEnabled()) {
      return originalRender.call(this, safeWidth);
    }

    if (safeWidth < MIN_BORDER_WIDTH) {
      return originalRender.call(this, safeWidth);
    }

    const innerWidth = Math.max(1, safeWidth - 2);
    const lines = originalRender.call(this, innerWidth);
    const normalizedLines = normalizeVerticalPadding(lines);
    const contentLines =
      normalizedLines.length > 0 ? normalizedLines : [" ".repeat(innerWidth)];
    const theme = getTheme();

    return [
      buildTopBorder(safeWidth, theme),
      ...contentLines.map((renderLine) =>
        wrapContentLine(renderLine, safeWidth, theme),
      ),
      buildBottomBorder(safeWidth, theme),
    ];
  };

  prototype.__piUserMessageNativePatched = true;
}

export default function registerNativeUserMessageBox(
  pi: ExtensionAPI,
  getConfig: () => ToolDisplayConfig,
): void {
  let activeTheme: ThemeLike | undefined;

  const getTheme = (): ThemeLike | undefined => activeTheme;
  const isEnabled = (): boolean => getConfig().enableNativeUserMessageBox;

  patchUserMessageRender(getTheme, isEnabled);

  pi.on("before_agent_start", async () => {
    patchUserMessageRender(getTheme, isEnabled);
  });

  pi.on("session_start", async (_event, ctx) => {
    activeTheme = ctx.ui.theme as unknown as ThemeLike;
    patchUserMessageRender(getTheme, isEnabled);
  });

  pi.on("session_switch", async (_event, ctx) => {
    activeTheme = ctx.ui.theme as unknown as ThemeLike;
    patchUserMessageRender(getTheme, isEnabled);
  });
}
