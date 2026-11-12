import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@subboost/ui/lib/utils";

const PROTOCOL_COLORS: Record<string, string> = {
  ss: "text-green-400",
  ssr: "text-blue-200",
  vmess: "text-blue-400",
  vless: "text-purple-400",
  trojan: "text-red-400",
  anytls: "text-teal-400",
  miu: "text-pink-400",
  hysteria2: "text-indigo-400",
  hy2: "text-indigo-400",
  tuic: "text-cyan-200",
  socks5: "text-yellow-400",
  socks4: "text-slate-200",
  http: "text-cyan-400",
  https: "text-cyan-400",
  snell: "text-lime-400",
  mieru: "text-amber-400",
  wireguard: "text-orange-400",
  ssh: "text-pink-200",
  relay: "text-violet-200",
};

export function getProtocolColorClass(type: string | undefined): string {
  const key = (type ?? "").trim().toLowerCase();
  return Object.hasOwn(PROTOCOL_COLORS, key) ? PROTOCOL_COLORS[key] : "text-slate-200";
}

export function getProtocolBadgeClass(type: string | undefined): string {
  return cn("bg-current/20 border-current/20", getProtocolColorClass(type));
}

type ProtocolBadgeProps = ComponentPropsWithoutRef<"span"> & {
  type: string | undefined;
};

export function ProtocolBadge({ type, className, ...props }: ProtocolBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] text-center uppercase whitespace-nowrap",
        getProtocolBadgeClass(type),
        className
      )}
      {...props}
    >
      {type}
    </span>
  );
}
