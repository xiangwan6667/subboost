import { describe, expect, it } from "vitest";
import { useConfigStore } from "../config-store";
import { initialState } from "./definitions";
import { normalizePersistedConfigState, partializeConfigState } from "./persistence";
import { newGroupAppearance } from "@subboost/core/icons/appearance";
import { buildDefaultSubBoostTemplateConfig } from "@subboost/core/config/defaults";

describe("appearance editor lifecycle",()=>{
  it("persists and hydrates exact settings without changing a legacy draft",()=>{
    const s={...initialState,groupAppearance:newGroupAppearance()};
    s.groupAppearance.groups["module:cloud"]={imageEnabled:false,iconMode:"manual",iconId:"Binance"};
    expect(normalizePersistedConfigState(partializeConfigState(s)).groupAppearance).toEqual(s.groupAppearance);
    expect(normalizePersistedConfigState({template:"standard"}).groupAppearance).toBeUndefined();
    const options=useConfigStore.persist.getOptions();
    expect(options.merge!({template:"minimal"},s as ReturnType<typeof useConfigStore.getState>).groupAppearance).toBeUndefined();
    expect(options.merge!(undefined,s as ReturnType<typeof useConfigStore.getState>).groupAppearance).toEqual(s.groupAppearance);
  });
  it("regenerates on save, restores masters without losing choices, and imports old templates as legacy",()=>{
    const previous=useConfigStore.getState();
    try {
      useConfigStore.setState({...initialState});
      const s=newGroupAppearance();s.groups["module:cloud"]={iconMode:"manual",iconId:"Binance"};
      useConfigStore.getState().setGroupAppearance(s);
      expect(useConfigStore.getState().groupAppearance).toEqual(s);
      useConfigStore.getState().setGroupAppearance({...s,imagesEnabled:false});
      expect(useConfigStore.getState().groupAppearance?.groups).toEqual(s.groups);
      const old=buildDefaultSubBoostTemplateConfig("minimal");delete old.groupAppearance;
      useConfigStore.getState().applyTemplateConfig(old);
      expect(useConfigStore.getState().groupAppearance).toBeUndefined();
      useConfigStore.getState().setTemplate("standard");
      expect(useConfigStore.getState().groupAppearance).toEqual(newGroupAppearance());
    } finally { useConfigStore.setState(previous); }
  });
});
