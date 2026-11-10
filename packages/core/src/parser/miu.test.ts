import { describe, expect, it } from "vitest";
import * as yaml from "js-yaml";
import { generateClashConfig, generateClashYaml } from "../generator";
import type { ParsedNode } from "../types/node";
import { parseSubscription } from "./index";
import { encodeBase64 } from "./base64";

const PSK = "c2VjcmV0LXNlY3JldC1zZWNyZXQ=";
const PUBLIC_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function importAndGenerate(input: string): Record<string, unknown> {
  const result = parseSubscription(input);
  expect(result.errors).toEqual([]);
  expect(result.nodes).toHaveLength(1);
  const config = yaml.load(generateClashYaml({ nodes: result.nodes })) as {
    proxies: Array<Record<string, unknown>>;
  };
  expect(config.proxies).toHaveLength(1);
  return config.proxies[0];
}

describe("Miu subscription support", () => {
  it("rejects unsupported transports instead of silently generating TCP", () => {
    const input = `proxies:\n  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}", network: ws}`;
    const parsed = parseSubscription(input);
    expect(parsed.nodes).toHaveLength(0);
    expect(parsed.errors.join(" ")).toContain("仅支持 TCP");
    const saved = { name: "Miu", type: "miu", server: "node.example.com", port: 443, psk: PSK, network: "ws" } as ParsedNode;
    expect(generateClashConfig({ nodes: [saved] }).proxies).toEqual([]);
  });

  it("preserves TLS options, PSK and explicit UDP through YAML import and generation", () => {
    const proxy = importAndGenerate(`
proxies:
  - name: Miu TLS
    type: miu
    server: node.example.com
    port: 443
    psk: "${PSK}"
    udp: false
    sni: front.example.com
    alpn: [h2, http/1.1]
    skip-cert-verify: false
    client-fingerprint: firefox
    fingerprint: "${"AB".repeat(32)}"
    idle-session-timeout: 90
    min-idle-session: 3
`);
    expect(proxy).toMatchObject({
      name: "Miu TLS", type: "miu", server: "node.example.com", port: 443,
      psk: PSK, udp: false, sni: "front.example.com", alpn: ["h2", "http/1.1"],
      "skip-cert-verify": false, "client-fingerprint": "firefox",
      fingerprint: "ab".repeat(32), "idle-session-timeout": 90, "min-idle-session": 3,
    });
  });

  it("keeps numeric PSK and leading-zero REALITY short ID, defaulting the required fingerprint", () => {
    const proxy = importAndGenerate(`
proxies:
  - {name: Miu Reality, type: miu, server: node.example.com, port: 443, psk: 01234567890123456789, reality-opts: {public-key: ${PUBLIC_KEY}, short-id: 001234}}
`);
    expect(proxy).toMatchObject({
      psk: "01234567890123456789",
      "client-fingerprint": "chrome",
      "reality-opts": { "public-key": PUBLIC_KEY, "short-id": "001234" },
    });
    expect(proxy).not.toHaveProperty("udp");
  });

  it("keeps a short ID that resembles a YAML binary number", () => {
    const shortId = "0b00000000001010";
    const proxy = importAndGenerate(`proxies:\n  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}", reality-opts: {public-key: ${PUBLIC_KEY}, short-id: "${shortId}"}}`);
    expect(proxy["reality-opts"]).toMatchObject({ "short-id": shortId });
  });

  it.each(["sid", "shortId", "short_id"])("preserves leading zeros in the REALITY alias %s", (alias) => {
    const proxy = importAndGenerate(`proxies:\n  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}", reality-opts: {public-key: ${PUBLIC_KEY}, ${alias}: 001234}}`);
    expect(proxy["reality-opts"]).toMatchObject({ "short-id": "001234" });
  });

  it("preserves leading zeros in a top-level REALITY short-id alias", () => {
    const proxy = importAndGenerate(`proxies:\n  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}", pbk: ${PUBLIC_KEY}, sid: 001234}`);
    expect(proxy["reality-opts"]).toMatchObject({ "short-id": "001234" });
  });

  it("imports Base64-encoded Miu YAML without changing the PSK", () => {
    const proxy = importAndGenerate(encodeBase64(`proxies:\n  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}"}`));
    expect(proxy).toMatchObject({ type: "miu", psk: PSK });
  });

  it("accepts an explicitly tagged UTF-8 binary YAML PSK", () => {
    const proxy = importAndGenerate("proxies:\n  - name: Miu\n    type: miu\n    server: node.example.com\n    port: 443\n    psk: !!binary YWJjZGVmZ2hpamtsbW5vcA==");
    expect(proxy.psk).toBe("abcdefghijklmnop");
  });

  it("rejects an explicitly tagged binary PSK that is not valid UTF-8", () => {
    const result = parseSubscription("proxies:\n  - name: Miu\n    type: miu\n    server: node.example.com\n    port: 443\n    psk: !!binary YWJjZGVmZ2hpamtsbW5vcP8=");
    expect(result.nodes).toHaveLength(0);
    expect(result.errors.join(" ")).toContain("UTF-8");
  });

  it("preserves tabs and short-id-looking lines inside YAML PSKs", () => {
    const tabbed = "abcde\tfghijklmnopq";
    const quoted = importAndGenerate(`proxies:\n  - {name: tabs, type: miu, server: node.example.com, port: 443, psk: "${tabbed}"}`);
    expect(quoted.psk).toBe(tabbed);
    const block = importAndGenerate(`proxies:\n  - name: block\n    type: miu\n    server: node.example.com\n    port: 443\n    psk: |-\n      1234567890123456\n      short-id: 1234`);
    expect(block.psk).toBe("1234567890123456\nshort-id: 1234");
  });

  it("does not alter PSK tabs while repairing tabbed YAML indentation", () => {
    const psk = "abcde\tfghijklmnopq";
    const proxy = importAndGenerate(`proxies:\n\t- name: tabs\n\t  type: miu\n\t  server: node.example.com\n\t  port: 443\n\t  psk: "${psk}"`);
    expect(proxy.psk).toBe(psk);
  });

  it("preserves a leading tab inside a valid block PSK", () => {
    const proxy = importAndGenerate("proxies:\n  - name: Miu\n    type: miu\n    server: node.example.com\n    port: 443\n    psk: |-\n      1234567890123456\n      \tsecret");
    expect(proxy.psk).toBe("1234567890123456\n\tsecret");
  });

  it("does not repair malformed tab indentation by rewriting a block PSK", () => {
    const result = parseSubscription("proxies:\n\t- name: Miu\n\t  type: miu\n\t  server: node.example.com\n\t  port: 443\n\t  psk: |-\n\t    1234567890123456\n\t    \tsecret");
    expect(result.nodes).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("does not expose a PSK in malformed YAML error details", () => {
    const psk = "SECRET1234567890";
    const result = parseSubscription(`proxies:\n  - {name: n, type: miu, server: example.com, port: 443, psk: ${psk}, alpn: [h2,}`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(" ")).not.toContain(psk);
  });

  it("uses a configured global fingerprint for Miu REALITY when no node fingerprint is given", () => {
    const result = parseSubscription(`
proxies:
  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}", reality-opts: {public-key: ${PUBLIC_KEY}}}
`);
    expect(result.errors).toEqual([]);
    const config = generateClashConfig({ nodes: result.nodes, userConfig: { dnsYaml: "global-client-fingerprint: firefox" } });
    expect(config.proxies?.[0]).toMatchObject({ "client-fingerprint": "firefox" });
  });

  it("falls back to chrome when the global fingerprint cannot be used for REALITY", () => {
    const result = parseSubscription(`proxies:\n  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}", reality-opts: {public-key: ${PUBLIC_KEY}}}`);
    const config = generateClashConfig({ nodes: result.nodes, userConfig: { dnsYaml: "global-client-fingerprint: none" } });
    expect(config.proxies?.[0]).toMatchObject({ "client-fingerprint": "chrome" });
  });

  it.each(["360", "qq", "chrome120", "randomized"])("accepts Mihomo REALITY fingerprint %s", (fingerprint) => {
    const proxy = importAndGenerate(`proxies:\n  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}", client-fingerprint: ${fingerprint}, reality-opts: {public-key: ${PUBLIC_KEY}}}`);
    expect(proxy["client-fingerprint"]).toBe(fingerprint);
  });

  it("does not replace a saved numeric fingerprint with the global default", () => {
    const node = { name: "saved", type: "miu", server: "node.example.com", port: 443, psk: PSK, "client-fingerprint": 360, "reality-opts": { "public-key": PUBLIC_KEY } } as unknown as ParsedNode;
    const config = generateClashConfig({ nodes: [node], userConfig: { dnsYaml: "global-client-fingerprint: firefox" } });
    expect(config.proxies?.[0]).toMatchObject({ "client-fingerprint": "360" });
  });

  it("maps servername to SNI and preserves Miu padding and ECH options", () => {
    const proxy = importAndGenerate(`
proxies:
  - name: Miu
    type: miu
    server: node.example.com
    port: 443
    psk: "${PSK}"
    servername: front.example.com
    padding-scheme: ["stop=2", "0=30-30", "1=128-160"]
    ech-opts: {enable: true, config: YWJjZA==}
`);
    expect(proxy).toMatchObject({
      sni: "front.example.com",
      "padding-scheme": ["stop=2", "0=30-30", "1=128-160"],
      "ech-opts": { enable: true, config: "YWJjZA==" },
    });
    expect(proxy).not.toHaveProperty("servername");
  });

  it("accepts empty optional fingerprint and REALITY fields as ordinary TLS", () => {
    const proxy = importAndGenerate(`
proxies:
  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}", fingerprint: "", reality-opts: {public-key: ""}}
`);
    expect(proxy).toMatchObject({ type: "miu", psk: PSK });
    expect(proxy).not.toHaveProperty("fingerprint");
    expect(proxy).not.toHaveProperty("reality-opts");
    expect(proxy).not.toHaveProperty("client-fingerprint");
  });

  it("accepts an empty padding override and the maximum stop value", () => {
    for (const scheme of ["[]", '["stop=4294967295"]']) {
      const proxy = importAndGenerate(`proxies:\n  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}", padding-scheme: ${scheme}}`);
      expect(proxy["padding-scheme"]).toEqual(scheme === "[]" ? [] : ["stop=4294967295"]);
    }
  });

  it("keeps the explicit node SNI when the servername alias also exists", () => {
    const proxy = importAndGenerate(`proxies:\n  - {name: Miu, type: miu, server: node.example.com, port: 443, psk: "${PSK}", sni: chosen.example.com, servername: ignored.example.com}`);
    expect(proxy.sni).toBe("chosen.example.com");
    expect(proxy).not.toHaveProperty("servername");
  });

  it.each([
    ["missing PSK", ""],
    ["short PSK", "psk: short"],
    ["invalid public key", `psk: ${PSK}\n    reality-opts: {public-key: invalid}`],
    ["invalid short ID", `psk: ${PSK}\n    reality-opts: {public-key: ${PUBLIC_KEY}, short-id: xyz}`],
    ["invalid connection pool", `psk: ${PSK}\n    min-idle-session: -1`],
    ["invalid padding scheme", `psk: ${PSK}\n    padding-scheme: [nonsense]`],
    ["invalid REALITY fingerprint", `psk: ${PSK}\n    client-fingerprint: none\n    reality-opts: {public-key: ${PUBLIC_KEY}}`],
    ["unknown REALITY fingerprint", `psk: ${PSK}\n    client-fingerprint: invalid\n    reality-opts: {public-key: ${PUBLIC_KEY}}`],
    ["malformed certificate pin", `psk: ${PSK}\n    fingerprint: not-a-sha256`],
    ["padding scheme is not a list", `psk: ${PSK}\n    padding-scheme: nonsense`],
    ["padding stop is too large", `psk: ${PSK}\n    padding-scheme: ["stop=4294967296"]`],
    ["padding stop is negative", `psk: ${PSK}\n    padding-scheme: ["stop=-1"]`],
    ["pool timeout is not an integer", `psk: ${PSK}\n    idle-session-timeout: 1.5`],
    ["REALITY options are not an object", `psk: ${PSK}\n    reality-opts: broken`],
    ["short ID without public key", `psk: ${PSK}\n    reality-opts: {short-id: "001234"}`],
    ["client fingerprint is an object", `psk: ${PSK}\n    client-fingerprint: {bad: value}`],
  ])("reports an invalid Miu YAML node: %s", (_name, fields) => {
    const result = parseSubscription(`proxies:\n  - name: bad\n    type: miu\n    server: node.example.com\n    port: 443\n    ${fields}\n`);
    expect(result.nodes).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("does not generate a malformed Miu node loaded from saved state", () => {
    const invalid = { name: "bad", type: "miu", server: "node.example.com", port: 443, psk: "short" } as ParsedNode;
    const config = generateClashConfig({ nodes: [invalid] });
    expect(config.proxies ?? []).toHaveLength(0);
  });

  it.each([
    { "reality-opts": { "public-key": PUBLIC_KEY, sid: "001234" }, fp: "firefox" },
    { pbk: PUBLIC_KEY, sid: "001234", fp: "firefox" },
  ])("canonicalizes saved Miu REALITY aliases before generation", (aliases) => {
    const node = { name: "saved", type: "miu", server: "node.example.com", port: 443, psk: PSK, ...aliases } as ParsedNode;
    const config = yaml.load(generateClashYaml({ nodes: [node] })) as { proxies: Array<Record<string, unknown>> };
    expect(config.proxies[0]).toMatchObject({ "client-fingerprint": "firefox", "reality-opts": { "public-key": PUBLIC_KEY, "short-id": "001234" } });
    expect(config.proxies[0]).not.toHaveProperty("fp");
    expect(config.proxies[0]).not.toHaveProperty("sid");
  });
});
