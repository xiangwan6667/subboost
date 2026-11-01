import { normalizeCertificateFingerprint } from "./certificate-fingerprint";
import { isRealityPublicKey, normalizeRealityShortId } from "./reality";
import { normalizeMihomoStringScalar } from "./string-scalar";

// Names accepted by Mihomo's uTLS client; REALITY cannot use "none".
const REALITY_FINGERPRINTS = new Set([
  "chrome", "firefox", "safari", "ios", "android", "edge", "360", "qq", "random",
  "chrome120", "firefox120", "safari16", "chrome_psk", "chrome_psk_shuffle",
  "chrome_padding_psk_shuffle", "chrome_pq", "chrome_pq_psk", "randomized",
]);

export function isMiuRealityFingerprint(value: unknown): boolean {
  const fingerprint = normalizeMihomoStringScalar(value)?.trim();
  return fingerprint !== undefined && REALITY_FINGERPRINTS.has(fingerprint);
}

/** Validate Miu's Mihomo options without decoding or otherwise changing the PSK. */
export function normalizeMiuNode(node: Record<string, unknown>, forGeneration = false): Record<string, unknown> {
  const out = { ...node };
  const psk = normalizeMihomoStringScalar(out.psk);
  // Go's strings.TrimSpace follows Unicode White_Space, which differs from JS trim() for NEL and BOM.
  const trimmedPsk = psk?.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
  if (psk === undefined || new TextEncoder().encode(trimmedPsk).length < 16) {
    throw new Error("Miu psk 至少需要 16 字节");
  }
  out.psk = psk;

  if (out.servername !== undefined) {
    if (!out.sni) out.sni = out.servername;
    delete out.servername;
  }

  if (out["client-fingerprint"] !== undefined && out["client-fingerprint"] !== null) {
    const fingerprint = normalizeMihomoStringScalar(out["client-fingerprint"]);
    if (fingerprint === undefined) throw new Error("Miu client-fingerprint 必须是字符串");
    if (fingerprint.trim()) out["client-fingerprint"] = fingerprint.trim();
    else delete out["client-fingerprint"];
  }

  for (const key of ["idle-session-timeout", "min-idle-session"]) {
    if (out[key] === undefined) continue;
    const value = out[key];
    const number = typeof value === "number" ? value
      : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
    if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Miu ${key} 必须是非负整数`);
    out[key] = number;
  }

  if (out["padding-scheme"] === null) delete out["padding-scheme"];
  if (out["padding-scheme"] !== undefined) {
    const scheme = out["padding-scheme"];
    if (!Array.isArray(scheme) || !scheme.every((line) => typeof line === "string")) {
      throw new Error("Miu padding-scheme 必须是字符串数组");
    }
    const text = scheme.join("\n");
    if (text) {
      let stop: string | undefined;
      for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        const separator = line.indexOf("=");
        if (separator >= 0 && line.slice(0, separator) === "stop") stop = line.slice(separator + 1).trim();
      }
      if (!stop || !/^\+?\d+$/.test(stop) || Number(stop) > 0xffffffff) {
        throw new Error("Miu padding-scheme 缺少有效的 stop 值");
      }
    }
  }

  if (typeof out.fingerprint === "string" && !out.fingerprint.trim()) {
    delete out.fingerprint;
  } else if (out.fingerprint !== undefined && !normalizeCertificateFingerprint(out.fingerprint)) {
    throw new Error("Miu fingerprint 必须是 SHA-256 证书指纹");
  }

  if (out["reality-opts"] !== undefined) {
    const raw = out["reality-opts"];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Miu reality-opts 必须是对象");
    const reality = { ...raw } as Record<string, unknown>;
    const rawPublicKey = reality["public-key"];
    const publicKey = typeof rawPublicKey === "string" ? rawPublicKey.trim() : "";
    const rawShortId = reality["short-id"];
    if (!publicKey && (rawPublicKey === undefined || typeof rawPublicKey === "string") && (rawShortId === undefined || rawShortId === "")) {
      delete out["reality-opts"];
    } else {
      if (!isRealityPublicKey(publicKey)) throw new Error("Miu REALITY public-key 无效");
      reality["public-key"] = publicKey;
      if (rawShortId !== undefined && rawShortId !== "") {
        const shortId = normalizeRealityShortId(rawShortId);
        if (!shortId) throw new Error("Miu REALITY short-id 无效");
        reality["short-id"] = shortId;
      }
      out["reality-opts"] = reality;
      const fingerprint = normalizeMihomoStringScalar(out["client-fingerprint"]);
      if (fingerprint && !isMiuRealityFingerprint(fingerprint)) throw new Error("Miu REALITY client-fingerprint 无效");
      if (forGeneration && !fingerprint) {
        out["client-fingerprint"] = "chrome";
      }
    }
  }
  return out;
}
