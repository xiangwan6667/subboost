import type { MiuNode } from "@subboost/core/types/node";
import { normalizeMiuNode } from "@subboost/core/mihomo/miu";
import { parseUrlWithNeutralScheme, safeDecodeFormUrlEncoded } from "./url-decode";

function firstParam(params: URLSearchParams, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && value !== "") return value;
  }
  return undefined;
}

function boolParam(params: URLSearchParams, ...keys: string[]): boolean | undefined {
  const raw = firstParam(params, ...keys);
  if (raw === undefined) return undefined;
  const value = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  throw new Error(`Miu ${keys[0]} 必须是布尔值`);
}

function queryPsk(search: string): string {
  const entries = search.replace(/^\?/, "").split("&");
  for (const name of ["psk", "password", "auth"]) {
    for (const entry of entries) {
      const separator = entry.indexOf("=");
      const key = separator < 0 ? entry : entry.slice(0, separator);
      if (decodeURIComponent(key.replace(/\+/g, " ")) !== name) continue;
      const value = decodeURIComponent((separator < 0 ? "" : entry.slice(separator + 1)).replace(/\+/g, " "));
      if (value) return value;
    }
  }
  return "";
}

/** SubBoost compatibility syntax; Miu itself does not define a share-link format. */
export function parseMiu(uri: string): MiuNode {
  if (!uri.startsWith("miu://")) throw new Error("无效的 Miu 链接");
  const url = parseUrlWithNeutralScheme(uri);
  const params = url.searchParams;
  const authority = uri.slice("miu://".length).split(/[/?#]/, 1)[0];
  const at = authority.lastIndexOf("@");
  let psk: string;
  try {
    psk = at >= 0 ? decodeURIComponent(authority.slice(0, at)) : queryPsk(url.search);
  } catch {
    throw new Error("Miu PSK 的 URL 编码无效");
  }
  const port = url.port ? (/^\d+$/.test(url.port) ? Number(url.port) : NaN) : 443;
  if (!url.hostname || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Miu 服务器地址或端口无效");
  if (url.pathname && url.pathname !== "/") throw new Error("Miu 不支持路径或其他传输层");

  const transport = (firstParam(params, "type", "network", "transport") || "tcp").toLowerCase();
  if (transport !== "tcp" && transport !== "none") throw new Error("Miu 仅支持 TCP 传输层");
  const security = (firstParam(params, "security") || "").toLowerCase();
  if (security && security !== "tls" && security !== "reality") throw new Error("Miu 仅支持 TLS 或 REALITY");
  const publicKey = firstParam(params, "pbk", "public-key", "publicKey", "public_key");
  const shortId = firstParam(params, "sid", "short-id", "shortId", "short_id");
  if ((security === "reality" && !publicKey) || (shortId && !publicKey) || (security === "tls" && (publicKey || shortId))) {
    throw new Error("Miu REALITY 参数不完整或与 TLS 冲突");
  }

  const node: MiuNode = {
    name: safeDecodeFormUrlEncoded(url.hash.slice(1)) || firstParam(params, "remarks", "remark") || `Miu-${url.hostname}:${port}`,
    type: "miu",
    server: url.hostname,
    port,
    psk,
  };
  const udp = boolParam(params, "udp");
  if (udp !== undefined) node.udp = udp;
  const insecure = boolParam(params, "allowInsecure", "allow_insecure", "allow-insecure", "insecure", "skip-cert-verify");
  if (insecure !== undefined) node["skip-cert-verify"] = insecure;
  const sni = firstParam(params, "sni", "servername", "serverName", "peer");
  if (sni) node.sni = sni;
  const clientFingerprint = firstParam(params, "fp", "client-fingerprint", "clientFingerprint");
  if (clientFingerprint) node["client-fingerprint"] = clientFingerprint;
  const fingerprint = firstParam(params, "fingerprint");
  if (fingerprint) node.fingerprint = fingerprint;
  const alpn = firstParam(params, "alpn");
  if (alpn) node.alpn = alpn.split(",").map((item) => item.trim()).filter(Boolean);
  if (publicKey) node["reality-opts"] = { "public-key": publicKey, ...(shortId ? { "short-id": shortId } : {}) };
  for (const [key, aliases] of [
    ["idle-session-timeout", ["idle-session-timeout", "idleSessionTimeout"]],
    ["min-idle-session", ["min-idle-session", "minIdleSession"]],
  ] as const) {
    const value = firstParam(params, ...aliases);
    if (value !== undefined) (node as unknown as Record<string, unknown>)[key] = value;
  }
  return normalizeMiuNode(node) as unknown as MiuNode;
}
