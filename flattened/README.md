# QCAI Audit — Flattened Source (DeedLockEscrow)

## The file

`DeedLockEscrow.flattened.sol` — the exact deployed source of the
**DeedLockEscrow** contract, flattened for the QCAI dashboard auditor.

- Contract: `DeedLockEscrow`
- Deployed: `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07` on QoreChain Diana
  testnet (chain ID 9800), deploy tx
  `0xe6baa83ee3ff023e66c011f88acbfaec248c9b889101a101a8b5d00316673b81`
  (2026-11-15).
- Generated with: `npx hardhat flatten contracts/DeedLockEscrow.sol`
  (Hardhat v2.29.2). It inlines the OpenZeppelin v5.6.1 sources the contract
  actually uses (`IERC20`, `SafeERC20`, `ReentrancyGuard` and their
  dependencies) plus the project's own `contracts/IQorePqc.sol` and
  `contracts/DeedLockEscrow.sol`. It contains **no test code** — the local
  mocks (`MockPqc`, `MockERC20`) are not imported by the deployed contract
  and do not appear in this file (the word "MockPqc" occurs only inside two
  documentation comments of the original source, which explain the
  constructor injection).
- SHA-256 of the flattened file:
  `531b533f58372214ce7398b75e729aaa2e90365c7af43ae6e8b4b228704329b4`

## Verification that this is the deployed source (byte-identical)

The contract source has not changed since deployment: `contracts/` has been
touched only by this repository's initial commit, and the hand-combined
paste source used for the first QCAI run on 2026-11-16
(`audit/paste-source-deployed.sol`, score 82) was diffed against today's
`contracts/` files — identical.

For this flattened file, each project-owned section was extracted and
diffed against its source file starting at the `pragma` line:

- `contracts/DeedLockEscrow.sol` section — non-blank lines identical; the
  only differences are blank lines left where the 4 `import` statements
  were replaced by the inlined sources (a normal flatten artifact). The
  fully whitespace-stripped SHA-256 of the flattened section and of the
  source (imports removed) match exactly:
  `a5ef123af1a9f03590345b64ea283463d6b365d64ebae0736b87da44ddd6de2f`.
- `contracts/IQorePqc.sol` section — identical the same way;
  whitespace-stripped SHA-256 match:
  `fc1b7962c49cb400d73aa3e8081dd87424489e69fcf20be31beb9d7b4dd7fb3a`.

So not one character of contract code differs from the deployed source.

## How to run the QCAI audit (per run)

1. Open https://dashboard.qorechain.io/audit and sign in with the project
   account.
2. The form has **no file upload** — paste the **entire contents** of
   `DeedLockEscrow.flattened.sol` into the "Contract Source Code" field.
3. Set **Blockchain = QoreChain**.
4. Run the audit. Cost shown by the dashboard: **150 QOR testnet** per run —
   confirm the payment prompt when asked (testnet QOR only; the charge is
   internal to the dashboard, the on-chain wallet balance does not move).
5. Wait for the result; record the score, risk level, quantum readiness and
   every finding, then **download the PDF**.
6. Two stages: run the audit **twice with this exact same file** (stage 1
   and stage 2). The dashboard keeps no audit history, so stage 2 is a
   fresh run on identical source — do not edit the file between stages.
7. Known dashboard behaviour: a run can fail silently (the panel returns to
   "Awaiting Input" with no result and no error). If that happens, stop
   after one attempt and report it — do not retry in a loop.

## Auditor context — what this contract is (honest version)

DeedLock is a down-payment (DP) escrow for property and vehicle purchases
in Indonesia, where the deed transfer (AJB / BPKB) can complete long after
the money changes hands. The buyer's funds sit in the contract and are
released to the seller in up to 5 milestone tranches. The design rule is
that `msg.sender` alone **never** moves money: every fund-moving approval
(tranche release, refund, arbitration, freeze/unfreeze) must additionally
carry a fresh **ML-DSA-87 (FIPS 204) signature**, verified on chain by the
QoreChain `pqcVerify` precompile (`0x0A01`), against the signer's ML-DSA
key registered on chain (`pqcKeyStatus` precompile, `0x0A02` — registration,
proof of possession, algorithm id and public-key hash are all checked). The
signature binds contract, escrow id, action, action parameter, a per-escrow
anti-replay nonce (consumed by every executed action) and a deadline. Both
buyer and seller must approve a tranche; the second approval executes the
payment. A buyer can refund the still-locked remainder after a timelock; a
party can raise a dispute and the arbiter resolves it with a PQ-signed
basis-point split; a guardian can freeze/unfreeze (PQ-signed) but has no
function that moves funds. The two precompile addresses are injected via
the constructor (so tests can substitute a mock) — on Diana they are the
real precompiles above. Native QOR escrows are funded with `msg.value`;
ERC-20 escrows use SafeERC20.

Live state on Diana at preparation time (2026-11-25), stated as it is:

- `escrowCount` is **3**.
- Escrow **#0** (our demo, 0.2 QOR in 2 tranches of 0.1): **fully Released**
  (both tranches paid to the seller after dual ML-DSA-87 approvals).
- Escrow **#2** (a second full cycle run 2026-11-19, 0.2 QOR): **fully
  Released** the same way.
- Escrow **#1** is **not ours**: it was created by an unrelated external
  account (0.2 QOR, status Created, never funded). It is documented here
  for honesty and left untouched.

Design limits, stated plainly:

- QCAI is a static, AI-assisted review: per its own documentation it does
  not compile, run or runtime-test the contract, and it is not a formal
  audit. It complements the 44-test Hardhat suite (all passing) and the
  live on-chain behaviour proofs in `deployments.testnet.json`.
- The on-chain AI precompiles (`aiRiskScore` / `aiAnomalyCheck`) are not
  active on Diana, so no "on-chain QCAI" claim is made — this audit is the
  dashboard tool only.
- A previous QCAI run of this exact source (2026-11-16) scored **82/100**,
  risk MEDIUM, with 5 findings — all triaged in writing in
  `audit/QCAI_AUDIT_PLAN.md` (3 false positives, 1 mitigated by design,
  1 informational; no code changes resulted). The report PDF is
  `audit/QCAI-report-DeedLockEscrow-2026-11-16.pdf`.
