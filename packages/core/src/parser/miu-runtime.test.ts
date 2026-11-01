import { execFile, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer as createHttpServer } from "node:http";
import { createSocket } from "node:dgram";
import { createServer as createTcpServer, connect } from "node:net";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { generateClashConfig, generateClashYaml } from "../generator";
import { configToYaml } from "../generator/yaml";
import type { ClashConfig } from "../types/config";
import { parseSubscription } from "./index";

const mihomo = process.env.MIU_MIHOMO_BIN;
const miuServer = process.env.MIU_SERVER_BIN;
const openssl = process.env.MIU_OPENSSL_BIN;
const execFileAsync = promisify(execFile);

async function reservePort(): Promise<number> {
  const server = createTcpServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForPort(port: number, process: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (process.exitCode !== null) throw new Error(`Process exited with code ${process.exitCode}`);
    const ready = await new Promise<boolean>((resolve) => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => resolve(false));
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Port ${port} did not open`);
}

async function roundTripUdp(proxyPort: number): Promise<string> {
  const echo = createSocket("udp4");
  const udp = createSocket("udp4");
  const control = connect({ host: "127.0.0.1", port: proxyPort });
  try {
    echo.on("message", (message, peer) => echo.send(message, peer.port, peer.address));
    echo.bind(0, "127.0.0.1");
    udp.bind(0, "127.0.0.1");
    await Promise.all([once(echo, "listening"), once(udp, "listening"), once(control, "connect")]);
    control.write(Buffer.from([5, 1, 0]));
    const [greeting] = await once(control, "data") as [Buffer];
    expect([...greeting]).toEqual([5, 0]);
    control.write(Buffer.from([5, 3, 0, 1, 0, 0, 0, 0, 0, 0]));
    const [association] = await once(control, "data") as [Buffer];
    expect([...association.subarray(0, 4)]).toEqual([5, 0, 0, 1]);
    const relayPort = association.readUInt16BE(8);
    const echoPort = echo.address().port;
    const packet = Buffer.concat([Buffer.from([0, 0, 0, 1, 127, 0, 0, 1, echoPort >> 8, echoPort & 255]), Buffer.from("Miu UDP OK")]);
    udp.send(packet, relayPort, "127.0.0.1");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const [response] = await Promise.race([
        once(udp, "message") as Promise<[Buffer]>,
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("UDP response timed out")), 10000); }),
      ]);
      return response.subarray(10).toString();
    } finally {
      if (timer) clearTimeout(timer);
    }
  } finally {
    control.destroy();
    udp.close();
    echo.close();
  }
}

describe.skipIf(!mihomo || !miuServer || !openssl)("Miu client integration", () => {
  it("passes TCP and UDP over TLS and TCP over REALITY using generated nodes", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "subboost-miu-"));
    const children: ChildProcess[] = [];
    const logs: string[] = [];
    const logOutput = (name: string, child: ChildProcess) => {
      child.stdout?.on("data", (data: Buffer) => logs.push(`${name}: ${data.toString()}`));
      child.stderr?.on("data", (data: Buffer) => logs.push(`${name}: ${data.toString()}`));
      children.push(child);
      return child;
    };
    const target = createHttpServer((_request, response) => response.end("Miu end-to-end OK"));
    try {
      const cert = path.join(dir, "cert.pem");
      const key = path.join(dir, "key.pem");
      const certResult = spawnSync(openssl!, ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-nodes", "-days", "1", "-keyout", key, "-out", cert, "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"], { encoding: "utf8", windowsHide: true });
      expect(certResult.status, certResult.stderr).toBe(0);
      const keygen = spawnSync(miuServer!, ["keygen"], { encoding: "utf8", windowsHide: true });
      expect(keygen.status, keygen.stderr).toBe(0);
      const publicKey = /publicKey:\s*(\S+)/.exec(keygen.stdout)?.[1];
      const privateKey = /privateKey:\s*(\S+)/.exec(keygen.stdout)?.[1];
      expect(publicKey).toBeTruthy();
      expect(privateKey).toBeTruthy();

      target.listen(0, "127.0.0.1");
      await once(target, "listening");
      const targetPort = (target.address() as { port: number }).port;
      const serverPort = await reservePort();
      const proxyPort = await reservePort();
      const realityPort = await reservePort();
      const realityProxyPort = await reservePort();
      const coverPort = await reservePort();
      const psk = "0x000000000000000f";
      const shortId = "0b00000000001010";
      const serverConfig = path.join(dir, "server.json");
      writeFileSync(serverConfig, JSON.stringify({ listen: `127.0.0.1:${serverPort}`, cert, key, users: [{ name: "test", psk }] }));
      const serverProcess = logOutput("TLS server", spawn(miuServer!, ["-c", serverConfig, "-v"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }));
      await waitForPort(serverPort, serverProcess);

      const cover = logOutput("cover", spawn(openssl!, ["s_server", "-accept", `127.0.0.1:${coverPort}`, "-cert", cert, "-key", key, "-tls1_3", "-www", "-quiet"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }));
      await waitForPort(coverPort, cover);
      const realityConfig = path.join(dir, "reality.json");
      writeFileSync(realityConfig, JSON.stringify({ listen: `127.0.0.1:${realityPort}`, reality: { dest: `127.0.0.1:${coverPort}`, serverNames: ["localhost"], privateKey, shortIds: [shortId] }, users: [{ name: "test", psk }] }));
      const realityServer = logOutput("REALITY server", spawn(miuServer!, ["-c", realityConfig, "-v"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }));
      await waitForPort(realityPort, realityServer);
      // Miu probes the cover server asynchronously before it can accept REALITY handshakes.
      await new Promise((resolve) => setTimeout(resolve, 6000));

      const input = `proxies:\n  - {name: miu-tls, type: miu, server: 127.0.0.1, port: ${serverPort}, psk: "${psk}", udp: true, servername: localhost, skip-cert-verify: true, padding-scheme: ["stop=2", "0=30-30", "1=128-160"]}\n  - {name: miu-reality, type: miu, server: 127.0.0.1, port: ${realityPort}, psk: "${psk}", sni: localhost, reality-opts: {public-key: ${publicKey}, short-id: "${shortId}"}}`;
      const parsed = parseSubscription(input);
      expect(parsed.errors).toEqual([]);
      expect(parsed.nodes).toHaveLength(2);
      const generated = yaml.load(generateClashYaml({ nodes: parsed.nodes })) as { proxies: unknown[] };
      expect(generated.proxies).toHaveLength(2);
      expect(generated.proxies[1]).toMatchObject({ "reality-opts": { "short-id": shortId } });
      const configFile = path.join(dir, "mihomo.yaml");
      const config = generateClashConfig({ nodes: parsed.nodes });
      writeFileSync(configFile, configToYaml({ "mixed-port": proxyPort, "allow-lan": false, mode: "rule", proxies: config.proxies, listeners: [{ name: "reality-in", type: "mixed", listen: "127.0.0.1", port: realityProxyPort, proxy: "miu-reality" }], rules: ["MATCH,miu-tls"] } as unknown as ClashConfig));
      const check = spawnSync(mihomo!, ["-t", "-d", dir, "-f", configFile], { encoding: "utf8", windowsHide: true, timeout: 30000 });
      expect(check.status, `${check.stdout}\n${check.stderr}`).toBe(0);
      const client = logOutput("mihomo", spawn(mihomo!, ["-d", dir, "-f", configFile], { cwd: dir, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }));
      await waitForPort(proxyPort, client);
      await waitForPort(realityProxyPort, client);
      for (const [name, port] of [["TLS", proxyPort], ["REALITY", realityProxyPort]] as const) {
        try {
          const result = await execFileAsync(process.platform === "win32" ? "curl.exe" : "curl", ["--silent", "--show-error", "--noproxy", "", "--socks5-hostname", `127.0.0.1:${port}`, "--max-time", "15", `http://127.0.0.1:${targetPort}/`], { timeout: 20000, windowsHide: true });
          expect(result.stdout).toBe("Miu end-to-end OK");
        } catch (error) {
          throw new Error(`${name} request failed: ${error}\n${logs.join("")}`);
        }
      }
      expect(await roundTripUdp(proxyPort)).toBe("Miu UDP OK");
    } finally {
      for (const child of children) {
        if (child.exitCode === null) {
          child.kill();
          await once(child, "exit").catch(() => undefined);
        }
      }
      await new Promise<void>((resolve) => target.close(() => resolve()));
      if (path.dirname(dir) === path.resolve(tmpdir()) && path.basename(dir).startsWith("subboost-miu-")) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  }, 60000);
});
