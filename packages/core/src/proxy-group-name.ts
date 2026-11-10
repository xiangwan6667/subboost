export type EmojiSplitResult = {
  emoji: string;
  label: string;
  hasEmojiPrefix: boolean;
};

export function splitLeadingEmoji(raw: string): EmojiSplitResult {
  const name = typeof raw === "string" ? raw.trim() : "";
  const separatorIndex = (() => {
    for (let i = 0; i < name.length; i += 1) {
      if (name[i].trim() === "") return i;
    }
    return -1;
  })();
  if (separatorIndex <= 0) return { emoji: "", label: name, hasEmojiPrefix: false };

  const first = name.slice(0, separatorIndex);
  const rest = name.slice(separatorIndex).trim();
  if (!rest) return { emoji: "", label: name, hasEmojiPrefix: false };

  // 若首段包含字母/数字/中文，大概率不是“emoji 前缀”
  if (/[A-Za-z0-9\u4e00-\u9fff]/.test(first)) {
    return { emoji: "", label: name, hasEmojiPrefix: false };
  }

  return { emoji: first, label: rest, hasEmojiPrefix: true };
}

/** Strip a real emoji prefix for display without removing ordinary punctuation. */
export function stripLeadingGroupEmoji(raw: string): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  const match = /^(\S+)\s+(.+)$/u.exec(name);
  if (!match) return name;
  const prefix = match[1];
  const emojiOnly = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\uFE0E\uFE0F\u200D\u{E0020}-\u{E007F}]+$/u.test(prefix) &&
    /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u.test(prefix);
  const keycap = /^(?:[#*0-9]\uFE0F?\u20E3)+$/u.test(prefix);
  return emojiOnly || keycap || prefix === "₿" ? match[2].trim() : name;
}

export function resolveProxyGroupModuleName(
  module: { emoji: string; name: string },
  override?: string
): string {
  const raw = typeof override === "string" ? override.trim() : "";
  if (!raw) return module.name;

  const parsed = splitLeadingEmoji(raw);
  if (parsed.hasEmojiPrefix) return raw;

  return `${module.emoji} ${raw}`.trim();
}

export function normalizeGroupNameWithDefaultEmoji(
  raw: string,
  defaultEmoji: string
): { full: string; emoji: string } {
  const name = typeof raw === "string" ? raw.trim() : "";
  const fallbackEmoji = typeof defaultEmoji === "string" && defaultEmoji.trim() ? defaultEmoji.trim() : "🧩";
  if (!name) return { full: "", emoji: fallbackEmoji };

  const parsed = splitLeadingEmoji(name);
  if (parsed.hasEmojiPrefix) return { full: name, emoji: parsed.emoji || fallbackEmoji };

  return { full: `${fallbackEmoji} ${name}`.trim(), emoji: fallbackEmoji };
}

