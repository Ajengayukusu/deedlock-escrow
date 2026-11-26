# QCAI Audit — DeedLockEscrow — Stage 1 Triage

- **Project:** DeedLock (DeedLockEscrow)
- **Audit date:** 26 November 2026 (PDF generated 11/26/2026, 8:05:41 AM)
- **Audit mode:** QoreChain dashboard (dashboard.qorechain.io/audit), Testnet, Blockchain = **qorechain** (not Auto-detect), NAME = DeedLockEscrow
- **Source audited:** `flattened/DeedLockEscrow.flattened.sol` (1,421 lines, 54,693 bytes), fetched fresh from `https://raw.githubusercontent.com/Ajengayukusu/deedlock-escrow/main/flattened/DeedLockEscrow.flattened.sol` on 26 Nov 2026 — byte-identical to the repo copy and to the deployed source.
- **Deployed contract:** `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07`
- **Report file:** `docs/QCAI-audit-stage1.pdf` (this repo)

## Verified scores (from PDF text, not from the browser view)

| Field | Value |
|---|---|
| Overall Security Score | **72/100** |
| Risk Level | **MEDIUM** |
| Quantum Readiness | **QUANTUM-SAFE** |
| Total vulnerabilities | **5** (1 HIGH, 2 MEDIUM, 1 LOW, 1 INFO) |
| Blockchain (PDF) | **qorechain** ✅ (correct — the 16 Nov run wrongly showed `ethereum` because it used Auto-detect) |

Executive summary (PDF): the contract implements a quantum-safe escrow system using ML-DSA-87 signatures; strong quantum resistance; medium-severity concerns regarding PQC key verification, potential reentrancy risks, and input validation; architecture sound with proper separation of concerns.

## Note on PDF line numbers

The line numbers printed in the PDF (`DeedLockEscrow.sol:297`, `:378`, `:194`, `:272`, `:317`) do **not** match the repo file `contracts/DeedLockEscrow.sol` (600 lines) exactly — only the `_pay` call-site number is close. The triage below identifies every finding by function and code content, and cites the **actual** line numbers in `contracts/DeedLockEscrow.sol` (verified by reading the file). The findings themselves describe real code that exists in the contract; only the PDF's line mapping is shifted.

## Note on the score vs. the 16 Nov run (82/100)

The contract source is **unchanged** since the 16 Nov run (the flattened source audited today is byte-identical to the deployed source). The score difference (82 → 72) is **not a code regression**: the 16 Nov run used Blockchain Auto-detect (PDF recorded `ethereum`, quantum "not scored"), while this run used Blockchain = QoreChain (quantum scored, QUANTUM-SAFE) and produced a different finding set from the analyzer. The two scores are not directly comparable.

## Triage

### 1. Insecure PQC Key Verification — HIGH — PDF: `DeedLockEscrow.sol:297`; actual: `contracts/DeedLockEscrow.sol:222`, in `_verifyPqc` (starts line 200)

**Claim:** the contract compares `keccak256(pubkey) != keccak256(onchainPubkey)` to verify the public key; this is supposedly vulnerable to collision attacks and does not validate the public-key structure.

**Verdict: FALSE POSITIVE.**

**Evidence:**
- `contracts/DeedLockEscrow.sol:222`: `if (keccak256(pubkey) != keccak256(onchainPubkey)) revert PqcPubkeyMismatch();`
- Comparing keccak256 hashes of two byte arrays is a standard, cryptographically sound equality test in Solidity. Producing a different `pubkey` with the same keccak256 hash requires a second-preimage attack on a 256-bit hash — computationally infeasible. Hash equality therefore implies byte equality for all practical purposes; the check achieves exactly what a byte-by-byte comparison would.
- The presented key must hash-match the key actually registered on chain for `msg.sender` (returned by `pqcKeyStatus`, lines 207–215). Any malformed or attacker-chosen key fails unless it is byte-identical to the registered key, so no separate length/structure check can add security here — the registered key is the reference, and only its exact bytes pass.
- The "collision attack" claim misunderstands keccak256 preimage resistance. No code change.

### 2. Potential Reentrancy in Pay Function — MEDIUM — PDF: `DeedLockEscrow.sol:378`; actual: `_pay` call sites lines 377, 415, 469–470; `_pay` definition line 592

**Claim:** `_pay` performs an external call to transfer funds; despite `ReentrancyGuard`, a recipient contract with a fallback could re-enter.

**Verdict: FALSE POSITIVE (mitigated by design).**

**Evidence:**
- Every caller of `_pay` carries the `nonReentrant` modifier: `approveRelease` (line 339), `claimRefund` (line 392), `arbitrate` (line 443). A re-entering call reverts on the guard (`ReentrancyGuardReentrantCall`).
- Checks-effects-interactions is followed in all three flows — all state is updated **before** `_pay` is called:
  - `approveRelease`: `remainingAmount -= amount; releasedAmount += amount; currentTranche += 1; approvalNonce += 1;` and possibly `status = Status.Released`, all before `_pay(e, e.seller, amount)` (line 377).
  - `claimRefund`: `remainingAmount = 0; approvalNonce += 1; status = Status.Refunded;` before `_pay(e, e.buyer, amount)` (line 415).
  - `arbitrate`: `remainingAmount = 0; releasedAmount += sellerAmount; approvalNonce += 1; status = Status.Resolved;` before the two `_pay` calls (lines 469–470).
- There is no state left for a re-entrant call to exploit even if the guard were absent. The equivalent finding in the 16 Nov run was also triaged as a false positive. No code change.

### 3. Missing Input Validation for Tranche Amounts — MEDIUM — PDF: `DeedLockEscrow.sol:194`; actual: `contracts/DeedLockEscrow.sol:268–275`, in `createEscrow`

**Claim:** the contract validates that tranches sum to `totalAmount` but does not validate that individual tranche amounts are within reasonable bounds or that their sum cannot overflow.

**Verdict: FALSE POSITIVE.**

**Evidence:**
- `contracts/DeedLockEscrow.sol:2`: `pragma solidity ^0.8.24;` — Solidity 0.8.x has checked arithmetic by default, so `sum += tranches[i]` (line 273) **reverts on overflow**; a silent overflow is impossible.
- Bounds are already implied: each tranche must be non-zero (`if (tranches[i] == 0) revert InvalidTrancheSchedule();`, line 272), the schedule has at most `MAX_TRANCHES = 5` entries, and the sum must equal `totalAmount` exactly (line 275). Every individual tranche is therefore bounded by `1 <= tranche <= totalAmount`. No additional range check can add security. No code change.

### 4. Redundant Checks in PQC Verification — LOW — PDF: `DeedLockEscrow.sol:272`; actual: `_verifyPqc`, `contracts/DeedLockEscrow.sol:200–250`

**Claim:** `_verifyPqc` performs several checks (key registration, proof-of-possession, algorithm ID, pubkey match) that could be simplified or consolidated.

**Verdict: NOT APPLICABLE (accepted by design).**

**Evidence:**
- Each check guards a **distinct** invariant, and removing any one opens a distinct attack:
  - `block.timestamp > deadline` → `SignatureExpired()` (line 206): bounds the signature in time.
  - `!registered` → `PqcKeyNotRegistered()` (line 217): the caller must have an on-chain ML-DSA key.
  - `!possessionProven` → `PqcPossessionNotProven()` (line 218): the key owner proved possession at registration.
  - `algorithmId != MLDSA87_ALGORITHM_ID` → `PqcWrongAlgorithm()` (line 219): the key must be ML-DSA-87, not another algorithm.
  - `keccak256(pubkey) != keccak256(onchainPubkey)` → `PqcPubkeyMismatch()` (line 222): the presented key must be the registered key.
  - `!ok` from `pqcVerify` → `PqcBadSignature()` (line 238): the signature itself must verify.
- These are the security boundary of the contract, not redundancy. Consolidating them would only hide which invariant failed. The readability cost is deliberate. No code change.

### 5. PQC Precompile Dependency Management — INFO — PDF: `DeedLockEscrow.sol:317`; actual: constructor, `contracts/DeedLockEscrow.sol:162–164`

**Claim:** the contract depends on specific precompile addresses (0x0A01, 0x0A02) documented but not validated in the constructor; deployment could break if the addresses change.

**Verdict: ACCEPTED BY DESIGN.**

**Evidence:**
- The addresses are injected through the constructor **deliberately**, so tests can substitute `MockPqc` (documented in `contracts/IQorePqc.sol` header and in the constructor NatSpec, lines 157–161). Deployment uses the documented Diana precompile addresses `0x0A01` (`pqcVerify`) and `0x0A02` (`pqcKeyStatus`).
- Precompiles have no contract code, so an `extcodesize` check cannot validate them; validating "functionality" in the constructor would require a live precompile call at deploy time for a deployment-configuration concern, not a contract-logic flaw.
- Accepted as a deployment-configuration risk, documented here. No code change.

## Triage summary

| # | Finding | Severity | Verdict |
|---|---|---|---|
| 1 | Insecure PQC Key Verification | HIGH | False positive |
| 2 | Potential Reentrancy in Pay Function | MEDIUM | False positive (mitigated by design) |
| 3 | Missing Input Validation for Tranche Amounts | MEDIUM | False positive |
| 4 | Redundant Checks in PQC Verification | LOW | Not applicable (accepted by design) |
| 5 | PQC Precompile Dependency Management | INFO | Accepted by design |

**Result: 0 real issues.** 3 false positives, 1 not applicable, 1 accepted by design. No code changes required. The contract's core invariant holds: `msg.sender` alone never releases money — every fund-moving action requires a valid ML-DSA-87 signature over a domain-bound, nonce-consumed, deadline-bounded message, verified against the caller's registered on-chain key.
