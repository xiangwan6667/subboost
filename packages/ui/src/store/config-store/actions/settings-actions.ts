import { normalizeGroupIconOverrides } from "@subboost/core/generator/group-icons";
import { normalizeProxyGroupEditorOrder } from "../proxy-group-editor-order";
import type { ConfigActions } from "../definitions";
import { parseNodeNameFilterConfig } from "@subboost/core/subscription/node-name-filter";
import type { GetState, SetAndGenerateConfig, SetState } from "../store-types";

type SettingsActions = Pick<
  ConfigActions,
  | "setDnsYaml"
  | "setMixedPort"
  | "setAllowLan"
  | "setTestUrl"
  | "setTestInterval"
  | "setSharedHealthChecks"
  | "setShowGroupEmoji"
  | "setShowGroupIcons"
  | "setGroupIconOverride"
  | "setProxyGroupEditorOrder"
  | "setRuleProviderBaseUrl"
  | "setNodeNameFilter"
  | "setProxyGroupAdvancedModeEnabled"
  | "setCnIpNoResolve"
  | "setExperimentalCnUseCnRuleSet"
>;

export function createSettingsActions(
  set: SetState,
  _get: GetState,
  setAndGenerateConfig: SetAndGenerateConfig
): SettingsActions {
  return {
    setProxyGroupEditorOrder: (category, order) => {
      const normalized = normalizeProxyGroupEditorOrder({ [category]: order });
      if (!Object.hasOwn(normalized, category)) return;
      set((state) => ({
        proxyGroupEditorOrder: { ...state.proxyGroupEditorOrder, [category]: normalized[category] },
      }));
    },

    setDnsYaml: (yaml: string) => {
      setAndGenerateConfig(() => ({ dnsYaml: yaml }));
    },

    setMixedPort: (port: number) => {
      setAndGenerateConfig(() => ({ mixedPort: port }));
    },

    setAllowLan: (allow: boolean) => {
      setAndGenerateConfig(() => ({ allowLan: allow }));
    },

    setTestUrl: (url: string) => {
      setAndGenerateConfig(() => ({ testUrl: url }));
    },

    setTestInterval: (interval: number) => {
      setAndGenerateConfig(() => ({ testInterval: interval }));
    },

    setSharedHealthChecks: (enabled: boolean) => {
      setAndGenerateConfig(() => ({ sharedHealthChecks: enabled === true }));
    },

    setShowGroupEmoji: (enabled: boolean) => {
      setAndGenerateConfig(() => ({ showGroupEmoji: enabled === true }));
    },

    setShowGroupIcons: (enabled: boolean) => {
      setAndGenerateConfig(() => ({ showGroupIcons: enabled === true }));
    },

    setGroupIconOverride: (key, iconId) => {
      setAndGenerateConfig((state) => {
        const next = { ...state.groupIconOverrides };
        if (iconId === null) delete next[key];
        else {
          const valid = normalizeGroupIconOverrides({ [key]: iconId });
          if (!Object.hasOwn(valid, key)) return {};
          next[key] = valid[key];
        }
        return { groupIconOverrides: next };
      });
    },

    setRuleProviderBaseUrl: (url: string) => {
      setAndGenerateConfig(() => ({ ruleProviderBaseUrl: url }));
    },

    setNodeNameFilter: (config) => {
      setAndGenerateConfig(() => ({
        nodeNameFilter: parseNodeNameFilterConfig(config),
      }));
    },

    setProxyGroupAdvancedModeEnabled: (value: boolean) => {
      setAndGenerateConfig(() => ({ proxyGroupAdvancedModeEnabled: Boolean(value) }));
    },

    setCnIpNoResolve: (value: boolean) => {
      setAndGenerateConfig(() => ({ cnIpNoResolve: Boolean(value) }));
    },

    setExperimentalCnUseCnRuleSet: (value: boolean) => {
      setAndGenerateConfig(() => ({ experimentalCnUseCnRuleSet: Boolean(value) }));
    },
  };
}
