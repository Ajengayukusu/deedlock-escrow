# AI_USAGE.md — DeedLock Escrow

*Documentation for the Best AI-Native Build special award: what the AI did,
what the human decided, and how every AI-generated artefact was verified.*

## Human (Ajeng Ayu Kusuma) — direction & decisions

- Chose the problem space: fraud-prone down payments (DP) in Indonesian
  property and used-vehicle sales, and the Post-Quantum dApp category.
- Set the non-negotiable quality bar: 10/10, no basic/template submissions,
  enter to win — and the product constraints the contract encodes: dual
  ML-DSA approval for releases, milestone tranches, a PQ-bound arbiter,
  timelocked refunds, and a guardian that can freeze but never pay.
- Owns all accounts, keys and submissions: GitHub, X, QoreX (testnet) and the
  contest registration are the human's; no AI ever holds a recovery phrase or
  a private key belonging to the human.
- Decides go/no-go at each phase gate (research → foundation spike → build →
  deploy → submit).

## AI agent (Mica / Muse) — research, engineering & documentation

### Research phase (all claims verified against live sources)
- Read the full fest site (rules, kits, start, about) and the fest docs on
  docs.qorechain.io; cross-checked prize splits and deadlines and *recorded
  the contradictions* between the homepage table and the Rules page instead
  of silently picking one.
- Analysed 15+ competitor projects from the public feed and their GitHub
  repos to find the quality bar (Sentinel / Sealed Disclosure / QoreWitness)
  and the saturated idea list this project avoids (no certificate, checker,
  tip jar, single-owner vault or invoice agent).
- Verified chain facts **by calling Diana directly**, not just reading docs:
  `eth_chainId` = 9800, `active_static_precompiles` contains 0x0901 / 0x0A01 /
  0x0A02 / 0x0C01 (AI precompiles absent), CrossVM params/allowlist, abstract
  account config, and live npm versions (@qorechain/sdk 0.14.0 etc.).
- Ran a foundation spike with the official `qorechain/build-before-qday`
  examples and `create-qorechain-dapp` 0.14.0 to prove the bootstrap order
  (faucet → register PQC key first → scoped window → deploy) and to document
  the faucet blocker precisely.

### Build phase (this repository)
- Wrote `DeedLockEscrow.sol`, `IQorePqc.sol`, `MockPqc.sol`, `MockERC20.sol`
  from the verified precompile ABIs — including the two traps the research
  surfaced: the precompile's argument order `(pubkey, signature, message)`
  (≠ the JS SDK helper order) and `pqcKeyStatus`'s 4-value return.
- Wrote the 44-test Hardhat suite, deliberately attack-first: 10 tests are
  named ATTACK/negative cases (ECDSA-only, pubkey swap, replay, expiry,
  cross-escrow domain reuse, missing registration, missing proof of
  possession, rogue guardian).
- Built the Vite/React demo frontend as a faithful simulation of the
  contract's state machine and validation rules.
- Wrote `scripts/deploy.ts` with the bootstrap prerequisites encoded as
  documentation and a hard chain-id guard (refuses non-Diana networks).
- Drafted the README (judge path, requirement → evidence table, threat
  model, honest limits) and the two-stage QCAI audit plan, including the
  explicit refusal to claim an "on-chain QCAI audit" — the AI precompiles
  that would power it are inactive, which the research verified live.

### Verification of AI output (nothing shipped unverified)
- `npx hardhat compile` — clean (solc 0.8.24).
- `npx hardhat test` — **44 passing, 0 failing**, run for real in this repo.
- `npx tsc --noEmit` — clean (deploy script + tests typecheck).
- `cd frontend && npm run build` — clean (tsc + vite production build).
- Every chain fact in the README traces to a live call or an official doc
  URL listed in the project strategy file; deployment facts were written
  down only after the live deployment was verified on chain (the contract
  address and transaction hashes are recorded in
  `deployments.testnet.json`).

## Division of labour, in one line

The human picked the fight, the rules of engagement and owns the keys;
the AI did the research, engineering and paperwork — and every claim it
produced was checked against the chain, the compiler or the test runner
before it was written down.
