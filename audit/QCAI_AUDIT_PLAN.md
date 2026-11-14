# QCAI Audit Plan — DeedLock Escrow (Two-Stage, Honest Version)

## What "two-stage QCAI audit" actually means here — read this first

There is **no official definition** of a "two-stage QCAI audit" in the
QoreChain documentation, and this project does not pretend otherwise. What
exists today:

1. **The Dashboard Contract Auditor (QCAIA)** at
   https://dashboard.qorechain.io/audit — paste contract source, receive a
   score, risk level, findings and recommendations. It is free once per UTC
   day (extra runs cost test-QOR on testnet). Its own documentation states it
   is **not a formal audit**: it does not compile, run or runtime-test the
   contract. Public reports live at `dashboard.qorechain.io/audits/<id>`.
2. **The on-chain AI precompiles** (`aiRiskScore` 0x0B01 / `aiAnomalyCheck`
   0x0B02) are **NOT active** on Diana testnet or on mainnet (verified live:
   they are absent from `active_static_precompiles`). Any submission claiming
   an "on-chain QCAI audit" via those precompiles is claiming something the
   chain does not currently do. **DeedLock makes no such claim.**

So the two stages below are the strongest *honest* interpretation, and both
produce artefacts a judge can open and check.

---

## Stage 1 — Pre-deployment audit (before any testnet deploy)

| Step | Action | Artefact |
|---|---|---|
| 1.1 | Freeze the exact source of `contracts/DeedLockEscrow.sol` + `contracts/IQorePqc.sol` that will be deployed (record git commit hash). | commit hash in audit log below |
| 1.2 | Run the full local suite: `npx hardhat test` — must be 100% green, including all ATTACK tests. | test output (44 tests at v1) |
| 1.3 | Paste the frozen source into https://dashboard.qorechain.io/audit and run the QCAIA auditor. | public report URL `/audits/<id>` |
| 1.4 | Triage EVERY finding in writing: fixed / accepted-with-reason / false-positive-with-reason. No silent dismissals. | findings table in this file |
| 1.5 | Fix all accepted findings; re-run the local suite after each fix. | new commit hashes |

## Stage 2 — Post-fix re-audit + deployment evidence

| Step | Action | Artefact |
|---|---|---|
| 2.1 | Re-run QCAIA on the FINAL source (this is the "second stage": the auditor must see the code that actually ships, not the draft). | second public report URL `/audits/<id>` |
| 2.2 | Confirm the Stage-2 report corresponds to the deployed bytecode: deploy from the same commit, then verify source ↔ bytecode on the explorer. | explorer verification link — ⏳ deployment DONE 2026-11-15 (contract `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07`, deploy tx `0xe6baa83ee3ff023e66c011f88acbfaec248c9b889101a101a8b5d00316673b81`); explorer verification still pending the dashboard/explorer session |
| 2.3 | Publish both report URLs in the README's evidence table, side by side, with the delta (what was found, what changed). | README section "Two-stage QCAI audit" |
| 2.4 | If a later contract version ships (v2+), repeat Stage 1 + Stage 2 for that version. An audit of v1 says nothing about v2. | new rows in the audit log |

## Audit log (to be filled during the live phase)

| Date | Stage | Source commit | Report URL | Findings | Status |
|---|---|---|---|---|---|
| _(pending — dashboard run needs the user's signed-in dashboard session; scheduled as its own step)_ | 1 | — | — | — | ⏸ |
| _(pending — same session as Stage 1)_ | 2 | — | — | — | ⏸ |
| 2026-11-15 | Deployment (Stage 2.2 input) | shipped source (this repo) | n/a — chain evidence in `deployments.testnet.json` | Deployed to Diana: `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07`; live dual-ML-DSA release of tranche 1 executed; garbage-signature approval reverted `PqcBadSignature`; local suite re-run green (44 passing) | ✅ deployment done — QCAI report runs (1.3 / 2.1) still outstanding, deliberately not run without the user's dashboard sign-in |

## Known limits of this plan

- QCAIA is a static, AI-assisted review. It complements — never replaces —
  the 44-test Hardhat suite, the threat model in the README, and human
  review.
- The auditor's free tier is 1 run per UTC day; the two stages should be
  scheduled on different days or budgeted in test-QOR.
- If dashboard.qorechain.io/audit changes its terms/output, this plan is
  updated and the change is noted here — the plan follows the real tool, not
  the other way around.
