import { describe, expect, it } from "vitest";
import * as yaml from "js-yaml";
import { generateClashYaml } from "../generator";
import { encodeBase64 } from "./base64";
import { parseMiu, parseNodeLink, parseSubscription } from "./index";

const PSK = "key:with@characters+and=more";
const PUBLIC_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const link = `miu://${encodeURIComponent(PSK)}@[2001:db8::1]:8443?security=reality&pbk=${PUBLIC_KEY}&sid=001234&sni=front.example.com&fp=firefox&udp=0&allowInsecure=1&alpn=h2,http%2F1.1&fingerprint=${"AB".repeat(32)}&idle-session-timeout=120&min-idle-session=2#Miu%20Reality`;

describe("Miu compatibility links", () => {
  it("imports a REALITY link and preserves its fields through YAML generation", () => {
    const result = parseSubscription(link);
    expect(result.errors).toEqual([]);
    expect(result.nodes).toHaveLength(1);
    const config = yaml.load(generateClashYaml({ nodes: result.nodes })) as { proxies: Array<Record<string, unknown>> };
    expect(config.proxies[0]).toMatchObject({
      name: "Miu Reality", type: "miu", server: "2001:db8::1", port: 8443,
      psk: PSK, udp: false, sni: "front.example.com", alpn: ["h2", "http/1.1"],
      "skip-cert-verify": true, "client-fingerprint": "firefox", fingerprint: "ab".repeat(32),
      "reality-opts": { "public-key": PUBLIC_KEY, "short-id": "001234" },
      "idle-session-timeout": 120, "min-idle-session": 2,
    });
  });

  it("imports Base64 subscriptions with a Miu link alongside other protocols", () => {
    const content = `${link}\ntrojan://secret@other.example.com:443#Trojan`;
    const result = parseSubscription(encodeBase64(content));
    expect(result.errors).toEqual([]);
    expect(result.nodes.map((node) => node.type)).toEqual(["miu", "trojan"]);
    expect(result.nodes[0]).toMatchObject({ psk: PSK });
  });

  it("uses port 443 when omitted and retains the Miu UDP default", () => {
    const node = parseNodeLink(`miu://${encodeURIComponent(PSK)}@node.example.com#TLS`);
    expect(node).toMatchObject({ type: "miu", server: "node.example.com", port: 443, psk: PSK });
    expect(node).not.toHaveProperty("udp");
  });

  it("supports a URL-encoded PSK in the query", () => {
    const node = parseNodeLink(`miu://node.example.com:443?psk=${encodeURIComponent(PSK)}`);
    expect(node).toMatchObject({ psk: PSK });
  });

  it("supports a query password alias and explicit TLS options", () => {
    const node = parseNodeLink(`miu://node.example.com?password=${encodeURIComponent(PSK)}&security=tls&udp=yes&allow-insecure=off&servername=front.example.com&alpn=h2,http%2F1.1`);
    expect(node).toMatchObject({ psk: PSK, udp: true, "skip-cert-verify": false, sni: "front.example.com", alpn: ["h2", "http/1.1"] });
  });

  it("rejects an unrelated scheme when called directly", () => {
    expect(() => parseMiu("trojan://secret@node.example.com:443")).toThrow("无效的 Miu 链接");
  });

  it.each(["1234567890abcdef:", "1234567890abcdef::"])(
    "preserves a PSK with trailing colons: %s",
    (psk) => {
      const node = parseNodeLink(`miu://${psk}@node.example.com:443`);
      expect(node).toMatchObject({ psk });
    },
  );

  it.each(["\u0000", "\u0007", "\t", "\r", "\u001b", "\u007f", "\u0085", "\u009f", "\ufeff"])("preserves control character %j in the PSK while emitting valid YAML", (character) => {
    const psk = `abcdefghijklmnop${character}qrst`;
    const result = parseSubscription(`miu://${encodeURIComponent(psk)}@node.example.com:443`);
    expect(result.errors).toEqual([]);
    const config = yaml.load(generateClashYaml({ nodes: result.nodes })) as { proxies: Array<Record<string, unknown>> };
    expect(config.proxies[0].psk).toBe(psk);
  });

  it("uses Go's Unicode whitespace rules when checking PSK length", () => {
    const tooShort = `\u0085${"a".repeat(15)}\u0085`;
    const bom = `\ufeff${"a".repeat(15)}`;
    expect(parseSubscription(`miu://${encodeURIComponent(tooShort)}@node.example.com:443`).nodes).toHaveLength(0);
    const parsed = parseSubscription(`miu://${encodeURIComponent(bom)}@node.example.com:443`);
    expect(parsed.nodes).toMatchObject([{ psk: bom }]);
    const generated = yaml.load(generateClashYaml({ nodes: parsed.nodes })) as { proxies: Array<Record<string, unknown>> };
    expect(generated.proxies[0].psk).toBe(bom);
  });

  it("redacts an embedded Miu link even in a malformed mixed line", () => {
    const result = parseSubscription("foo://x|miu://SECRET1234567890@example.com|broken");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(" ")).not.toContain("SECRET1234567890");
  });

  it("rejects malformed percent encoding in a query PSK without exposing it", () => {
    const result = parseSubscription("miu://node.example.com:443?psk=abcdefghijklmnop%2");
    expect(result.nodes).toHaveLength(0);
    expect(result.errors.join(" ")).not.toContain("abcdefghijklmnop");
  });

  it.each(["0x1234567890abcdef", "0X1234567890abcdef", "0o1234567012345670", "0b1010101010101010"])(
    "preserves a numeric-looking PSK %s through YAML output",
    (psk) => {
      const parsed = parseSubscription(`miu://${psk}@node.example.com:443`);
      const generated = yaml.load(generateClashYaml({ nodes: parsed.nodes })) as { proxies: Array<Record<string, unknown>> };
      expect(generated.proxies[0].psk).toBe(psk);
    },
  );

  it.each([
    ["short PSK", "miu://short@node.example.com:443"],
    ["invalid port", `miu://${PSK}@node.example.com:12x`],
    ["REALITY without a public key", `miu://${PSK}@node.example.com:443?security=reality`],
    ["REALITY options with explicit TLS", `miu://${PSK}@node.example.com:443?security=tls&pbk=${PUBLIC_KEY}`],
    ["unsupported transport", `miu://${PSK}@node.example.com:443?type=ws`],
    ["invalid pool setting", `miu://${PSK}@node.example.com:443?min-idle-session=2x`],
    ["invalid PSK encoding", "miu://abcdefghijklmnop%2@node.example.com:443"],
    ["missing PSK", "miu://node.example.com:443"],
    ["missing server", `miu://${PSK}@:443`],
    ["zero port", `miu://${PSK}@node.example.com:0`],
    ["out of range port", `miu://${PSK}@node.example.com:65536`],
    ["non-TLS security", `miu://${PSK}@node.example.com?security=none`],
    ["unsupported path", `miu://${PSK}@node.example.com/path`],
    ["short ID without public key", `miu://${PSK}@node.example.com?sid=001234`],
    ["invalid UDP flag", `miu://${PSK}@node.example.com?udp=maybe`],
    ["invalid certificate-verification flag", `miu://${PSK}@node.example.com?allowInsecure=maybe`],
  ])("reports %s without exposing the link or PSK", (_name, invalidLink) => {
    const result = parseSubscription(invalidLink);
    expect(result.nodes).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(" ")).not.toContain(PSK);
    expect(result.errors.join(" ")).not.toContain("short@");
  });
});
