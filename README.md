# DeedLock Escrow — Post-Quantum Down-Payment Escrow

[![Built on QoreChain](https://build.qorechain.io/badge/deedlock-escrow.svg)](https://build.qorechain.io/p/deedlock-escrow)

**Live demo:** https://ajengayukusu.github.io/deedlock-escrow/

**Demo video (≤ 3 min):** https://www.youtube.com/watch?v=HdANzE-E2fY

> **DP jual-beli properti & kendaraan bekas, dikunci oleh dua tanda tangan ML-DSA-87.**
> Built for the **QoreChain Developer Fest "Build Before Q-Day"** — **Post-Quantum dApp** category.
> Testnet: **QoreChain Diana** (EVM chain ID 9800) · Contract: Solidity 0.8.24 · License: MIT

---

## ⏱ Judge path — 3 minutes

1. **The problem (30 s).** In Indonesia, down payments (DP) for houses and used cars are
   routinely lost: sellers vanish after the DP, buyers are pressured to release money
   before the deed (AJB) or vehicle title (BPKB) is transferred. A classical multisig
   does not solve this long-term — escrow disputes can surface *years* later, when a
   quantum attacker could forge an ECDSA approval from a leaked public key
   (*harvest now, forge later*).
2. **The fix (30 s).** `DeedLockEscrow.sol` locks the DP and releases it in milestones.
   **Every fund-moving action requires a fresh ML-DSA-87 (FIPS 204) signature, verified
   on chain by QoreChain's `pqcVerify` precompile, bound to the signer's registered
   on-chain key.** `msg.sender` alone never moves money.
3. **Proof it works (60 s).** Run the test suite — **44 tests, including 10 attack
   tests** (ECDSA-only approval, pubkey swap, replay, expired deadline, guardian trying
   to pay out, non-proven arbiter…) — all passing:
   ```bash
   npm install && npx hardhat test
   ```
4. **See it (60 s).** Open the hosted demo at https://ajengayukusu.github.io/deedlock-escrow/
   (a simulation of the exact contract state machine — create → fund → two-party
   PQ approvals → milestone timeline → dispute / freeze / refund), or run it
   locally:
   ```bash
   cd frontend && npm install && npm run dev   # http://localhost:5173
   ```
5. **Deployment status.** **LIVE on Diana since 2026-11-15.** DeedLockEscrow is
   deployed at `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07` (deploy tx
   `0xe6baa83ee3ff023e66c011f88acbfaec248c9b889101a101a8b5d00316673b81`) against
   the **real** PQC precompiles, and a full escrow was executed on chain:
   created → funded (0.2 QOR) → **buyer ML-DSA-87 approval → seller ML-DSA-87
   approval → tranche 1 (0.1 QOR) released to the seller → both parties
   approved again → tranche 2 (0.1 QOR) released — escrow #0 fully
   `Released`, all 0.2 QOR paid out**, plus a live
   garbage-signature approval that reverted with `PqcBadSignature`. Every tx
   hash is in the evidence table below and in `deployments.testnet.json`.
   Still outstanding (tracked honestly, not claimed): the two QCAI dashboard
   audit reports, which need a signed-in dashboard session — see
   `audit/QCAI_AUDIT_PLAN.md`.

---

## How it works

```
 Buyer ──create──▶ Escrow(Created) ──fund──▶ Funded
                                                │
              tranche i releases ONLY when      │  buyer approves (PQ sig) AND
              seller approves (PQ sig)          ▼
                                  Funded ──all tranches──▶ Released
                                  Funded ──timelock passed + buyer PQ refund──▶ Refunded
                                  Funded ──raiseDispute──▶ Disputed ──arbiter PQ decision──▶ Resolved
              Guardian (PQ sig) can freeze/unfreeze Funded or Disputed escrows.
              Freezing pauses releases & refunds — it can NEVER move funds,
              and arbitration stays available so a frozen escrow always has an exit.
```

**Milestones:** 1–5 tranches fixed at creation; the schedule must sum exactly to the
funded total, so an over-release is impossible by construction.

**Assets:** native QOR, or any ERC-20 (e.g. the Diana fest token **fUSD**).

### The PQ gate (every sensitive action)

`approveRelease`, `arbitrate`, `freeze`, `unfreeze` and `claimRefund` all run the
same check in `DeedLockEscrow._verifyPqc`:

1. `pqcKeyStatus(msg.sender)` (precompile `0x0A02`) must return
   **registered = true**, **possessionProven = true**, **algorithmId = 1 (ML-DSA-87)**
   — the full 4-value return of chain v3.2.4+.
2. The presented pubkey must hash-match the key actually registered on chain:
   `keccak256(pubkey) == keccak256(onchainPubkey)`.
3. `pqcVerify(pubkey, signature, message)` (precompile `0x0A01` — argument order
   *pubkey, signature, message*) must return `true` for the domain-bound message

   ```
   message = keccak256(abi.encode(
       escrowContract, escrowId, action, extra, nonce, deadline))
   ```

   `extra` binds the tranche index (`APPROVE_RELEASE`) or the arbiter's split
   (`ARBITRATE`, seller bps). Every executed action **consumes the per-escrow
   nonce**, so a captured signature can never be replayed; `deadline` bounds it
   in time.

On Diana, signatures are produced off chain by the QoreChain SDK / QoreX from the
account's registered ML-DSA-87 key. Locally, `MockPqc.sol` reproduces the
precompiles' behaviour contract so the logic is fully testable (see *Honest
limits* for exactly what the mock does and does not prove).

---

## Category requirements → evidence

| Post-Quantum dApp requirement | Where DeedLock satisfies it | Evidence |
|---|---|---|
| Scoped EVM window | Deploy + contract interactions on Diana happen from accounts whose EVM authorisation window was opened (tx/value caps) via the native lane before any EVM tx — see *Bootstrap order* | Buyer window-open tx `1705A8A44C64C4A71E40E6DF5F44219B2142F6059713175BA704BDF1AA3F5FD6` (20 txs / 15 QOR cap); seller window-open tx `D10F6B0306AF106BB01B5DE2C5197D0371AE62E86C2D483D1BDBD9990A4BA886` (3 txs / 0.45 QOR cap) — both hybrid-signed native txs |
| `pqcVerify` for sensitive actions | `_verifyPqc()` in `contracts/DeedLockEscrow.sol` gates release, arbitration, freeze/unfreeze and refund; checks `pqcKeyStatus` (registered + possession-proven + algorithm) and pubkey binding before calling `pqcVerify(0x0A01)` | Contract source + 44 Hardhat tests incl. 10 attack tests + **live proof**: both parties' real ML-DSA-87 signatures returned `true` from the live `0x0A01` precompile (eth_call pre-flight) and executed on chain (see *Live evidence*); a garbage signature reverted live with `PqcBadSignature` |
| Two-stage QCAI audit | Stage 1: QCAIA dashboard audit of the frozen pre-deploy source, all findings triaged/fixed. Stage 2: re-audit of the final shipped source + explorer source↔bytecode verification. Both report URLs published here | `audit/QCAI_AUDIT_PLAN.md` (incl. why no "on-chain AI audit" is claimed — those precompiles are inactive). Deployment artefact (Stage 2.2 input) is live; the two dashboard report runs are the one remaining step and need a signed-in dashboard session — **not yet claimed as done** |
| Foundry/Hardhat tests | Hardhat + TypeScript suite, positive + negative/attack coverage | `npx hardhat test` → **44 passing** (re-run after deployment, 2026-11-15) |
| Deployed on Diana testnet | `scripts/deploy.ts` targets chain ID 9800 and refuses any other chain | Contract `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07` · deploy tx `0xe6baa83ee3ff023e66c011f88acbfaec248c9b889101a101a8b5d00316673b81` · full record in `deployments.testnet.json` |

### Live evidence (Diana testnet, 2026-11-15)

Parties are throwaway testnet accounts derived for this demo (buyer = deployer;
seller funded + registered fresh for this run — see `deployments.testnet.json`
for all addresses and both parties' `pqcKeyStatus` precompile reads:
registered ✓, algorithmId 1 ✓, possession-proven ✓, on-chain pubkey
keccak-matches the signing key ✓).

| Step | Lane | Tx hash | Result |
|---|---|---|---|
| Buyer registers ML-DSA-87 key (first tx) | Native | `84EBDFC9544E82FA961A45265F3976C274152A7F012BD8897BFD9721FF687CCC` | code 0 · `found:true, possession_proven:true` |
| Buyer hybrid send (PQC proof) | Native | `9B1AA39F2D087A1BCB31496A9DD57AF6039A784236DCF861F790AB3C2F785BAD` | `pqc_hybrid_verify status=verified` |
| Buyer opens EVM window | Native | `1705A8A44C64C4A71E40E6DF5F44219B2142F6059713175BA704BDF1AA3F5FD6` | window live (20 txs / 15 QOR) |
| Fund seller 1 QOR (hybrid) | Native | `67CD988BD07FB120925CB7CDAE14FCEE6572D596D5074A9F126E5B3F2F70AB33` | code 0 |
| Seller registers ML-DSA-87 key (its first tx) | Native | `183639CEFC0A2DF61268A9E7198C59FAE698C4BD5EE76F7181E44756AE688291` | code 0 · `found:true, possession_proven:true` |
| Seller opens EVM window | Native | `D10F6B0306AF106BB01B5DE2C5197D0371AE62E86C2D483D1BDBD9990A4BA886` | window live (3 txs / 0.45 QOR) |
| **Deploy DeedLockEscrow** | EVM | `0xe6baa83ee3ff023e66c011f88acbfaec248c9b889101a101a8b5d00316673b81` | contract `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07` |
| Create escrow #0 (0.2 QOR, tranches 0.1 + 0.1) | EVM | `0x128900a8ed99aa50ec476bbec416193e30bb4df3755f6699b77a68844fc513e9` | success |
| Fund escrow #0 | EVM | `0x60b12f2b2c77bc047d079f45fae30bd034065b4c9772a2bfe699cdced29f236c` | success |
| **Buyer approves tranche 1 (ML-DSA-87)** | EVM | `0x945441f20f61370dade0b6090eeb5c1354ff7b2da380357413c4cf5f216f7ddd` | success · signature pre-flight `pqcVerify = true` |
| **Seller approves tranche 1 (ML-DSA-87) → release executes** | EVM | `0x1525330808b5c1e07fa773e57d5b1bf621b4abed9db23f3157c780c3d945f888` | success · `TrancheApproved` + `TrancheReleased` events · seller +0.1 QOR (net +0.0583 QOR after his gas) |
| **Buyer approves tranche 2 (ML-DSA-87)** | EVM | `0xcb0e018abfa9be3d51ed525870be4a0b84f3fe7408d1c7ea0ca1585100fc9f8a` | success · signature pre-flight `pqcVerify = true` |
| **Seller approves tranche 2 (ML-DSA-87) → release executes** | EVM | `0xfd01aa4f44b5feacff07e34812b0ec3d6d735d2a7e1e8b2e56ff1322e59eb3ad` | success · `TrancheApproved` + `TrancheReleased` events · seller +0.1 QOR (net +0.0643 QOR after his gas) · escrow #0 status → `Released` |
| Negative: garbage signature approval | EVM | `0x9e496f6521e657efc61c7ce9c49a39703e306cad9bb50fc26d5b7db27dfa6da6` | **reverted** · decoded error `PqcBadSignature` (eth_call simulation + on-chain receipt) |

Final on-chain state of escrow #0: `releasedAmount = 0.2 QOR` (the full
funded amount), `remainingAmount = 0`, `currentTranche = 2`,
`approvalNonce = 2` (all four approvals consumed — both parties, both
tranches), status `Released`: every tranche released in full to the seller.

## Run it

```bash
# contracts + tests
npm install
npx hardhat compile
npx hardhat test          # 44 passing

# frontend demo (local, no chain needed)
cd frontend
npm install
npm run dev               # http://localhost:5173
npm run build             # production build check
```

### Bootstrap order for the live deployment (do NOT reorder)

1. **Faucet** — fund the deployer (coin-type 60) at https://dashboard.qorechain.io/faucet
   (paste the `qor1...` address; 100 QOR / 24 h).
2. **Register the ML-DSA-87 key** — must be the account's **first** transaction
   (MsgRegisterPQCKeyV2 + proof of possession; SDK `ensurePqcRegistered`).
3. **Open a scoped EVM window** (hybrid-signed) covering the deployment.
4. **Deploy:**
   ```bash
   DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy.ts --network diana
   ```
5. Verify `pqc_hybrid_verify status=verified` on the native-lane txs and the
   contract on https://explore.qore.network (Testnet).

Deploying before step 2/3 is rejected by the EVM lane (pqc codes 26/27/28) —
the script header repeats these prerequisites.

---

## Threat model

| Attack | Defence in DeedLock | Test |
|---|---|---|
| Attacker recovers a party's **ECDSA key** (the Q-Day scenario) and calls `approveRelease` | Call succeeds as `msg.sender` but fails the PQ gate: no valid ML-DSA-87 signature for the registered key → `PqcBadSignature` | "ECDSA-only approval (garbage ML-DSA signature) is rejected" |
| Attacker presents **someone else's pubkey** with a signature valid for that key | Pubkey must hash-match `msg.sender`'s own on-chain registered key → `PqcPubkeyMismatch` | "presenting someone else's pubkey is rejected" |
| **Replay** of a captured approval/freeze signature | Message binds escrow id, action, tranche/bps and a per-escrow nonce that is consumed on execution | "replaying a consumed approval signature…" · "replaying a freeze signature…" |
| **Stale signature** used long after signing | `deadline` inside the signed message; expired → `SignatureExpired` | "an expired signature deadline is rejected" |
| Signature reused against a **different escrow** (cross-domain) | Message binds `address(this)` + `escrowId` | "a signature bound to a different escrow id is rejected" |
| Account registered a key but **never proved possession** (key-squatting) | `possessionProven` from `pqcKeyStatus` is mandatory | "a registered key WITHOUT proof of possession cannot approve" · arbiter variant |
| **Guardian goes rogue** and tries to drain the escrow | Guardian has no fund-moving function; `approveRelease` rejects non-parties, `claimRefund` is buyer-only, `arbitrate` is arbiter-only | "the guardian cannot release funds" |
| **Seller pressures early refund / buyer stalls forever** | Refund is buyer-only, PQ-signed, and impossible before the funding timelock expires; dispute path stays open | "refund before the timelock expires is rejected" |
| Release **more than funded** | Tranche schedule must sum to the total at creation; releases only follow the schedule; post-completion approvals revert | "rejects a tranche schedule that does not sum to the total" · "approving after completion reverts" |
| **Reentrancy** via native payout callback | All payouts are last-step effects behind OpenZeppelin `ReentrancyGuard`; state is updated before transfer | suite-wide (state asserted after every payout) |
| Arbiter **alters the split** after signing | `sellerBps` is bound into the signed message (`extra`) | arbitration tests use bps-bound signatures throughout |

## Honest limits

- **MockPqc is not cryptography.** Locally, "valid signature" is a keyed hash so
  tests can model *valid vs anything else*. On Diana the real precompiles perform
  genuine FIPS 204 ML-DSA-87 verification. The contract logic (key binding, nonce,
  deadline, roles, state machine) is identical in both worlds; the signature
  primitive is the chain's, not ours.
- **QCAIA audit ≠ formal audit.** See `audit/QCAI_AUDIT_PLAN.md`: the dashboard
  auditor is static and AI-assisted; the on-chain AI precompiles are inactive, so
  no on-chain audit is claimed. The Hardhat suite is the primary local evidence.
- **The guardian is a trusted pauser.** A guardian can freeze (griefing = delay),
  never steal. Choosing the guardian is part of the deal setup, like choosing the
  arbiter.
- **The arbiter is trusted for the split.** DeedLock guarantees the arbiter's
  decision is authentically theirs (PQ-signed, bps-bound, non-replayable) — it
  cannot guarantee the decision is *fair*. Pick arbiters accordingly (e.g. a
  notary / PPAT office for property deals).
- **Deadlines use block timestamps**, standard for EVM contracts; the refund
  timelock is measured from funding time.
- **Deployed and executed live on Diana (2026-11-15)** — see *Live evidence*.
  What is NOT yet done, and is not claimed anywhere: the two QCAI dashboard
  audit reports (they require a signed-in dashboard session) and the explorer
  source↔bytecode verification that pairs with Stage 2. The live demo covers
  create → fund → dual-PQC-approval release of both tranches (escrow #0
  fully `Released`, all 0.2 QOR paid out) and a reverted
  garbage-signature approval; the dispute, freeze and refund paths are
  covered by the local suite (44 tests) but were not run live.

## Repository layout

```
contracts/   DeedLockEscrow.sol · IQorePqc.sol · MockPqc.sol (tests) · MockERC20.sol (tests)
test/        DeedLockEscrow.test.ts — 44 tests (positive + attack)
scripts/     deploy.ts — Diana (9800) deployment, refuses other chains
deployments.testnet.json — live deployment record: address, parties, every native + EVM tx hash, verification results
frontend/    Vite + React + TS demo (local simulation of the contract flow)
audit/       QCAI_AUDIT_PLAN.md — honest two-stage audit plan + log
AI_USAGE.md  How AI was used to build this project, and what humans decided
```

## Credits

Built with the official QoreChain stack: `@qorechain/sdk` / `create-qorechain-dapp`
0.14.0 patterns, the Diana PQC precompiles (0x0A01 / 0x0A02), OpenZeppelin
Contracts 5 (ReentrancyGuard, SafeERC20) and Hardhat. Fest:
https://build.qorechain.io — docs: https://docs.qorechain.io/build-before-qday
