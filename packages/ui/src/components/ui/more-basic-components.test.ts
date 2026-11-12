import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

function mockPrimitive(tag: keyof React.JSX.IntrinsicElements, displayName: string) {
  const Component = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    ({ children, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)
  );
  Component.displayName = displayName;
  return Component;
}

vi.mock("@radix-ui/react-label", () => ({ Root: mockPrimitive("label", "LabelRoot") }));

import {
  artisticNavContainerClassName,
  artisticTabsIconClassName,
  artisticTabsListClassName,
  artisticTabsTriggerClassName,
  getArtisticNavButtonClassName,
  getArtisticNavIconClassName,
} from "./artistic-nav";
import { Label } from "./label";
import { ProtocolBadge, getProtocolBadgeClass, getProtocolColorClass } from "./protocol-badge";
import { SafeImage } from "./safe-image";
import { Textarea } from "./textarea";

describe("additional basic UI components", () => {
  it("renders label, textarea, protocol badges, and safe images", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement(Label, { htmlFor: "name", className: "label-extra" }, "Name"),
        React.createElement(Textarea, { placeholder: "Write", className: "textarea-extra", readOnly: true }),
        React.createElement(ProtocolBadge, { type: "VMess", className: "badge-extra" }),
        React.createElement(SafeImage, { src: "https://example.test/a.png", alt: "avatar", fallback: React.createElement("span", null, "fallback") }),
        React.createElement(SafeImage, { src: null, fallback: React.createElement("span", null, "fallback") })
      )
    );

    expect(html).toContain("label-extra");
    expect(html).toContain("Name");
    expect(html).toContain("textarea-extra");
    expect(html).toContain("placeholder=\"Write\"");
    expect(html).toContain("VMess");
    expect(html).toContain("badge-extra");
    expect(html).toContain("src=\"https://example.test/a.png\"");
    expect(html).toContain("fallback");
  });

  it("computes protocol and artistic nav classes", () => {
    expect(getProtocolBadgeClass(" vmess ")).toContain("text-blue-400");
    expect(getProtocolBadgeClass("unknown")).toContain("slate");
    expect(getArtisticNavButtonClassName({ active: true, size: "md", className: "extra" })).toContain("extra");
    expect(getArtisticNavButtonClassName({ active: true, size: "md" })).toContain("text-seg-active-fg");
    expect(getArtisticNavButtonClassName({ active: false })).toContain("hover:bg-ink/5");
    expect(getArtisticNavIconClassName(true, "icon-extra")).toContain("icon-extra");
    expect(getArtisticNavIconClassName(false)).toContain("text-fg-45");
    expect(artisticNavContainerClassName).toContain("rounded-full");
    expect(artisticTabsListClassName).toContain("h-auto");
    expect(artisticTabsTriggerClassName).toContain("data-[state=active]");
    expect(artisticTabsIconClassName).toContain("group-data-[state=active]");
  });

  it.each([
    ["ss", "green"],
    ["socks5", "yellow"],
    ["trojan", "red"],
    ["vless", "purple"],
    ["vmess", "blue"],
    ["hysteria2", "indigo"],
    ["anytls", "teal"],
    ["miu", "pink"],
    ["http", "cyan"],
    ["snell", "lime"],
    ["mieru", "amber"],
    ["wireguard", "orange"],
  ])("uses the reference color for %s badges and preview dots", (type, color) => {
    expect(getProtocolColorClass(type)).toBe(`text-${color}-400`);
    expect(getProtocolBadgeClass(type)).toContain(getProtocolColorClass(type));
    expect(getProtocolBadgeClass(type)).toContain("bg-current/20 border-current/20");
  });

  it("normalizes protocol names, shares alias colors, and safely handles unknown types", () => {
    expect(getProtocolColorClass(" SS ")).toBe(getProtocolColorClass("ss"));
    expect(getProtocolColorClass("hy2")).toBe(getProtocolColorClass("hysteria2"));
    expect(getProtocolColorClass("https")).toBe(getProtocolColorClass("http"));
    for (const type of [undefined, "", "unknown", "constructor", "__proto__"]) {
      expect(getProtocolColorClass(type)).toBe("text-slate-200");
    }
  });
});
