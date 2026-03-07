import {
  Markdown,
  truncateToWidth,
  visibleWidth,
  type DefaultTextStyle,
  type MarkdownTheme,
} from "@mariozechner/pi-tui";
import {
  patchUserMessageRenderPrototype,
  type PatchableUserMessagePrototype,
} from "./user-message-box-patch.js";
import { extractUserMessageMarkdownState } from "./user-message-box-markdown.js";

export type { PatchableUserMessagePrototype } from "./user-message-box-patch.js";
import {
  addUserMessageVerticalPadding,
  applyUserMessageBackground,
  normalizeUserMessageContentLine,
  normalizeUserMessageContentLines,
  type UserMessageBackgroundTheme,
} from "./user-message-box-utils.js";

export interface UserMessageTheme extends UserMessageBackgroundTheme {
  fg(color: string, text: string): string;
  bold?(text: string): string;
}

const MIN_BORDER_WIDTH = 8;
const TITLE_TEXT = " user ";
const CONTENT_HORIZONTAL_PADDING_COLUMNS = 1;
const USER_MESSAGE_PATCH_VERSION = 5;

function colorBorder(theme: UserMessageTheme | undefined, text: string): string {
  if (!text || !theme) {
    return text;
  }

  try {
    return theme.fg("border", text);
  } catch {
    return text;
  }
}

function colorTitle(theme: UserMessageTheme | undefined, title: string): string {
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
  theme: UserMessageTheme | undefined,
  text: string,
): string {
  return applyUserMessageBackground(theme, text);
}

function buildTopBorder(
  totalWidth: number,
  theme: UserMessageTheme | undefined,
): string {
  const innerWidth = Math.max(0, totalWidth - 2);
  const title = truncateToWidth(TITLE_TEXT, innerWidth, "");
  const fill = "─".repeat(Math.max(0, innerWidth - visibleWidth(title)));
  const row = `${colorBorder(theme, "╭")}${colorTitle(theme, title)}${colorBorder(theme, `${fill}╮`)}`;

  return colorUserBackground(theme, row);
}

function buildBottomBorder(
  totalWidth: number,
  theme: UserMessageTheme | undefined,
): string {
  const innerWidth = Math.max(0, totalWidth - 2);
  const row = `${colorBorder(theme, "╰")}${colorBorder(theme, `${"─".repeat(innerWidth)}╯`)}`;

  return colorUserBackground(theme, row);
}

function wrapContentLine(
  line: string,
  totalWidth: number,
  theme: UserMessageTheme | undefined,
): string {
  const sidePadding = " ".repeat(CONTENT_HORIZONTAL_PADDING_COLUMNS);
  const innerWidth = Math.max(
    1,
    totalWidth - 2 - CONTENT_HORIZONTAL_PADDING_COLUMNS * 2,
  );
  const normalizedLine = normalizeUserMessageContentLine(line);
  const content = truncateToWidth(normalizedLine, innerWidth, "", true);
  const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(content)));
  const row = `${colorBorder(theme, "│")}${sidePadding}${content}${padding}${sidePadding}${colorBorder(theme, "│")}`;

  return colorUserBackground(theme, row);
}

function renderUserMessageBodyLines(
  instance: unknown,
  innerWidth: number,
  originalRender: (width: number) => string[],
): string[] {
  const markdownState = extractUserMessageMarkdownState(
    instance as { children?: unknown[] },
  );
  if (!markdownState) {
    return originalRender.call(instance, innerWidth);
  }

  try {
    const markdown = new Markdown(
      markdownState.text,
      0,
      0,
      markdownState.theme as MarkdownTheme,
      markdownState.defaultTextStyle as DefaultTextStyle | undefined,
    );
    return markdown.render(innerWidth);
  } catch {
    return originalRender.call(instance, innerWidth);
  }
}

export function patchNativeUserMessagePrototype(
  prototype: PatchableUserMessagePrototype,
  getTheme: () => UserMessageTheme | undefined,
  isEnabled: () => boolean,
): void {
  patchUserMessageRenderPrototype(
    prototype,
    USER_MESSAGE_PATCH_VERSION,
    (originalRender) =>
      function renderWithNativeUserBorder(width: number): string[] {
        const safeWidth = Math.max(0, Math.floor(width));
        if (!isEnabled() || safeWidth < MIN_BORDER_WIDTH) {
          return originalRender.call(this, safeWidth);
        }

        const innerWidth = Math.max(1, safeWidth - 2);
        const lines = renderUserMessageBodyLines(this, innerWidth, originalRender);
        const contentLines = normalizeUserMessageContentLines(lines);
        const paddedContentLines = addUserMessageVerticalPadding(
          contentLines.length > 0 ? contentLines : [""],
        );
        const theme = getTheme();

        return [
          buildTopBorder(safeWidth, theme),
          ...paddedContentLines.map((renderLine) =>
            wrapContentLine(renderLine, safeWidth, theme),
          ),
          buildBottomBorder(safeWidth, theme),
        ];
      },
  );
}
