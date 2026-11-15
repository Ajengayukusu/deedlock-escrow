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
   **Correction from the live run (2026-11-16):** the current dashboard UI
   does **not** issue a public report URL — the report renders inline on the
   audit page and the only export offered is a PDF ("Export PDF"). The UI
   displays "Audit Cost: 150 QOR" with a Confirm dialog; on Testnet mode no
   wallet, balance or payment was engaged for the run below, and the UI never
   states whether the run consumed the free daily allowance. The deliverable
   of a run is therefore the exported PDF, kept in this `audit/` folder.
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
| 2.2 | Confirm the Stage-2 report corresponds to the deployed bytecode: deploy from the same commit, then verify source ↔ bytecode on the explorer. | Deployment DONE 2026-11-15 (contract `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07`, deploy tx `0xe6baa83ee3ff023e66c011f88acbfaec248c9b889101a101a8b5d00316673b81`). Explorer verification: **not applicable** — checked live 2026-11-16, explore.qore.network has no source-verification feature (the address renders as a generic account page; no code tab, no verify form). Correspondence rests on the public repo source (commit `f0e5fb9`), the deploy tx, and the live on-chain behaviour proofs. |
| 2.3 | Publish both report URLs in the README's evidence table, side by side, with the delta (what was found, what changed). | README section "Two-stage QCAI audit" |
| 2.4 | If a later contract version ships (v2+), repeat Stage 1 + Stage 2 for that version. An audit of v1 says nothing about v2. | new rows in the audit log |

## Audit log (to be filled during the live phase)

| Date | Stage | Source commit | Report URL | Findings | Status |
|---|---|---|---|---|---|
| 2026-11-16 | 2 (final deployed source; Stage 1 collapsed — see note below) | `f0e5fb98735adbf06ad19dca9639388ccd9f6f9e` | No public URL exists in the current UI — report rendered inline on the audit page; PDF exported to this folder (`QCAI-report-DeedLockEscrow-2026-11-16.pdf`) | Score **82**, risk **MEDIUM**, quantum-safe "Not scored" by the tool; 5 findings (1 HIGH, 2 MEDIUM, 1 LOW, 1 INFO) — all triaged below: 3 false positives, 1 mitigated by design, 1 informational. No code changes resulted. | ✅ run complete |
| 2026-11-15 | Deployment (Stage 2.2 input) | shipped source (this repo) | n/a — chain evidence in `deployments.testnet.json` | Deployed to Diana: `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07`; live dual-ML-DSA release of tranche 1 executed; garbage-signature approval reverted `PqcBadSignature`; local suite re-run green (44 passing) | ✅ deployment done — QCAI report runs (1.3 / 2.1) still outstanding, deliberately not run without the user's dashboard sign-in |

## Findings triage — run of 2026-11-16 (step 1.4)

Every finding from the report, triaged in writing against the deployed
source. No silent dismissals.

| # | Severity (tool) | Finding | Verdict | Reason, verifiable in the source |
|---|---|---|---|---|
| 1 | HIGH | "Missing Access Control on Critical Functions" — `freeze`/`unfreeze` (DeedLockEscrow.sol:372-390 in the pasted file) | **False positive** | Both functions require `msg.sender == e.guardian` (the guardian designated for that specific escrow at creation) **and** a valid ML-DSA-87 signature verified by `_verifyPqc` against the guardian's on-chain registered key (registration + proof-of-possession + algorithm + pubkey-hash match + anti-replay nonce + deadline). That is strictly stronger than a role check; the tool appears not to have traced `_verifyPqc`. State checks also exist: `freeze` requires Funded/Disputed and not already frozen; `unfreeze` requires frozen. |
| 2 | MEDIUM | "Potential Overflow in Tranche Calculation" — `arbitrate` multiplication (320-325) | **False positive** | `arbitrate` reverts `InvalidBps` when `sellerBps > 10_000` **before** the multiplication; `remainingAmount` is bounded by the funded total; and Solidity 0.8.24 checked arithmetic reverts on overflow regardless. |
| 3 | MEDIUM | "Potential Reentrancy Risk in `_pay`" (411-419) | **Mitigated by design — accepted, no change** | Every fund-moving entry point (`fund`, `approveRelease`, `claimRefund`, `arbitrate`) is `nonReentrant`, and all state (remaining/released amounts, status, nonce) is updated **before** `_pay` is called (checks-effects-interactions). The tool's suggestion to prefer `transfer` over `call` is outdated practice: the 2300-gas stipend breaks smart-contract wallets; `call` + `nonReentrant` + CEI is the current standard. |
| 4 | LOW | "Unbounded Loop in Tranche Validation" — `createEscrow` loop (185-192) | **False positive** | The loop is bounded by construction: `tranches.length > MAX_TRANCHES` (5) reverts before the loop, so it iterates at most 5 times. |
| 5 | INFO | "ERC20 Token Handling" (134-142) | **Informational — no action** | Positive note: the contract correctly handles native QOR and ERC20 (SafeERC20) paths. |

**Stage-collapse note (honesty):** Stage 1 of this plan assumed a pre-deploy
draft that would differ from the shipped code. In fact the deployed contract
is the repository's initial commit and the source never changed afterwards,
so there is no distinct "draft source" to audit retroactively. The single
run above therefore audits the exact deployed source — the artefact that
matters — and the README describes it as one audit with full triage rather
than claiming two stages that did not happen.

## Known limits of this plan

- QCAIA is a static, AI-assisted review. It complements — never replaces —
  the 44-test Hardhat suite, the threat model in the README, and human
  review.
- The auditor's free tier is 1 run per UTC day; the two stages should be
  scheduled on different days or budgeted in test-QOR.
- If dashboard.qorechain.io/audit changes its terms/output, this plan is
  updated and the change is noted here — the plan follows the real tool, not
  the other way around.
