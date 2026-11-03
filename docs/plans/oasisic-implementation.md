# Oasisic appearance implementation

Approved scope: self maintained icon fork; pinned catalogue; independent global and group image/emoji switches; automatic and manual matching; draft save/cancel; legacy compatibility; all policy references; template/local/server refresh persistence.

Tasks:
1. Normalize and preview Binance global + GoogleScholar; confirm before defaults. White background requested for Scholar.
2. Implement typed appearance model, pinned catalogue, generator and reference resolution; validate switches and collisions.
3. Connect persistence, templates, server refresh, and native UI components; validate cancellation and roundtrips.
4. Full test/coverage/lint/types/build and independent whole change review. Publish icon fork; report before SubBoost push.

Ledger:
- Baseline a0985a7, existing Miu branch reused as explicitly requested; clean working tree.
- Fork created xiangwan6667/Oasisic-Icons. Upstream style guide is password protected; using official Binance App Store publisher asset, preserving native black/gold colors. Scholar from Wikimedia SVG with attribution; white backdrop requested explicitly.

- Confirmed: Binance black/gold global symbol and GoogleScholar white background, 448px subject with32px inset. User explicitly approved final preview.
- Assets: fork commits4091601 (assets) and7ebb468 (manual CI); original19 validation groups +279 tests pass in GitHub Actions41633771006. PNG source pixel fidelity verified; public pinned URLs return200.
- Generator: four master combinations RED→GREEN; optional legacy semantics, manual/auto matching, country aliases, complex emoji, collision allocation, dialer/member/listener/rule YAML references covered.
- UI/store: draft Save/Cancel, stale session, empty matching, invalid comma/newline prefix, master restore, legacy same-version hydration, template and server refresh roundtrips covered. Browser verified native dialog and public image loading.
- Final review: independent fresh reviewer found two P2 issues (legacy fallback emoji on first appearance save, preview collision suffixes). Both reproduced RED then fixed GREEN; original raw name is authoritative and allocation is shared with preview. Duplicate-node name allocation is also shared. No deferred findings.
- Full coverage gate passes: statements98.33%, branches97.02%, functions98.08%, lines98.96%. Lint/UI consistency and types pass. Final build verification recorded at delivery.
- Delivery: icon fork published; SubBoost kept on existing Miu branch; no SubBoost push or PR as requested pending verification report.
