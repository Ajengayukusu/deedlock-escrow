// SPDX-License-Identifier: MIT
/**
 * pqc-approve.ts — DeedLock's post-quantum approval tool (QoreChain Diana).
 *
 * This is the tool that produced DeedLock's live ML-DSA-87 approvals for
 * escrow #0 on Diana (15 Nov 2026): buyer approval 0x945441f2…, seller
 * approval → tranche-1 release 0x15253308…, and the tranche-2 completion
 * approvals the same day. It was originally run from the shared foundation
 * workspace (foundation-spike/account-tools/deedlock-live-flow.mjs and
 * deedlock-tranche2-complete.mjs); it lives in this repo now so the repo
 * can reproduce its own headline flow end to end.
 *
 * The flow is byte-for-byte the one that ran live:
 *   1. Read the escrow state from the contract (status, current tranche,
 *      approval nonce) — the digest binds the CURRENT tranche, exactly as
 *      the contract's approveRelease expects.
 *   2. Pre-flight the signer's registered key via the pqcKeyStatus
 *      precompile (0x0A02): registered, possession-proven, algorithm 1
 *      (ML-DSA-87), and the on-chain pubkey must hash-match the derived one.
 *   3. Build the digest with the contract's own actionMessage():
 *      keccak256(abi.encode(contract, escrowId, "APPROVE_RELEASE",
 *      trancheIndex, nonce, deadline)), deadline = latest block + 1 hour.
 *   4. Sign the 32-byte digest with ML-DSA-87 via @qorechain/sdk's pqcSign
 *      (which is @qorechain/pqc's mldsa87.sign — cross-checked locally with
 *      mldsa87.verify from @qorechain/pqc before anything is broadcast).
 *   5. Pre-flight the signature against the live pqcVerify precompile
 *      (0x0A01) with eth_call — a failed pre-flight burns no window tx.
 *   6. Only then broadcast approveRelease(escrowId, pubkey, sig, deadline)
 *      from the signer's EVM account (inside its scoped EVM window).
 *
 * Usage:
 *   npx ts-node scripts/pqc-approve.ts <escrowId> <signerIndex> [expectedTranche]
 * (Plain ts-node, not `hardhat run`: Hardhat v2 rejects positional script
 * arguments. The script talks to Diana's RPC directly and needs no
 * Hardhat runtime.)
 *
 *   escrowId        The escrow to approve (e.g. 0).
 *   signerIndex     Derivation index of the signer in the secrets file
 *                   (0 = buyer/deployer, 1 = seller for the demo escrows).
 *                   The signer must be the escrow's buyer or seller.
 *   expectedTranche Optional safety guard: abort unless the escrow's
 *                   current on-chain tranche equals this value.
 *
 * Secrets: the mnemonic is read from the protected account file —
 * $QORE_SECRETS_PATH, defaulting to
 * ~/workspace/qorechain-contest/foundation-spike/.secrets/account.json.
 * Keys are never printed or written anywhere by this tool.
 */
import { derivePqcCanonical, deriveUnifiedAccount, pqcSign } from "@qorechain/sdk";
import { mldsa87 } from "@qorechain/pqc";
import { ethers } from "ethers";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const REST = "https://api-testnet.qore.host";
const EVM_RPC = "https://evm-testnet.qore.host";
/** DeedLockEscrow deployment on Diana (see deployments.testnet.json). */
const CONTRACT = "0xb6d7B326F44729772dbAD5B094B61E40C1a71b07";
const PQC_VERIFY = "0x0000000000000000000000000000000000000a01";
const PQC_KEY_STATUS = "0x0000000000000000000000000000000000000a02";
/** Sanity anchor from the live runs: derivation index 0 must be this account. */
const EXPECTED_IDX0_COSMOS = "qor1dcse33ce3n3mwxxleuupqvfqeq6xl552zm2ltk";
const ACTION = "APPROVE_RELEASE";
const DEADLINE_SECONDS = 3600n;

const ESCROW_ABI = [
  {
    type: "function",
    name: "getEscrow",
    stateMutability: "view",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [
      { name: "buyer", type: "address" },
      { name: "seller", type: "address" },
      { name: "arbiter", type: "address" },
      { name: "guardian", type: "address" },
      { name: "token", type: "address" },
      { name: "totalAmount", type: "uint256" },
      { name: "remainingAmount", type: "uint256" },
      { name: "releasedAmount", type: "uint256" },
      { name: "currentTranche", type: "uint256" },
      { name: "refundDeadline", type: "uint256" },
      { name: "approvalNonce", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "frozen", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "actionMessage",
    stateMutability: "view",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "action", type: "string" },
      { name: "extra", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "approveRelease",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "pubkey", type: "bytes" },
      { name: "signature", type: "bytes" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "trancheApprovals",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const KEY_STATUS_ABI = [
  {
    type: "function",
    name: "pqcKeyStatus",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "registered", type: "bool" },
      { name: "algorithmId", type: "uint8" },
      { name: "pubkey", type: "bytes" },
      { name: "possessionProven", type: "bool" },
    ],
  },
] as const;

const VERIFY_ABI = [
  {
    type: "function",
    name: "pqcVerify",
    stateMutability: "view",
    inputs: [
      { name: "pubkey", type: "bytes" },
      { name: "signature", type: "bytes" },
      { name: "message", type: "bytes" },
    ],
    outputs: [{ name: "valid", type: "bool" }],
  },
] as const;

const USAGE = `Usage: npx ts-node scripts/pqc-approve.ts <escrowId> <signerIndex> [expectedTranche]

  escrowId        Escrow to approve (e.g. 0)
  signerIndex     Derivation index of the buyer/seller signer (0 = buyer, 1 = seller)
  expectedTranche Optional guard: abort unless the escrow's current tranche matches

Secrets come from $QORE_SECRETS_PATH (default: the foundation-spike
protected account file). Nothing is broadcast unless the signer's key
status, the local ML-DSA-87 verification and the live pqcVerify
pre-flight ALL pass first.`;

function fail(message: string): never {
  console.error(`ABORT: ${message}`);
  process.exit(1);
}

function parseArgs(): { escrowId: bigint; signerIndex: number; expectedTranche?: bigint } {
  let tokens = process.argv.slice(2);
  const sep = tokens.indexOf("--");
  if (sep >= 0) {
    tokens = tokens.slice(sep + 1);
  } else {
    // Invoked without a "--" separator (plain ts-node / node): keep only the
    // bare numeric tokens, which drops the runner path and flags.
    tokens = tokens.filter((t) => /^\d+$/.test(t));
  }
  if (tokens.length < 2 || tokens.length > 3 || tokens.some((t) => !/^\d+$/.test(t))) {
    console.error(USAGE);
    process.exit(2);
  }
  return {
    escrowId: BigInt(tokens[0]),
    signerIndex: Number(tokens[1]),
    expectedTranche: tokens.length === 3 ? BigInt(tokens[2]) : undefined,
  };
}

async function main(): Promise<void> {
  const { escrowId, signerIndex, expectedTranche } = parseArgs();

  // --- secrets (never printed) ---
  const secretsPath =
    process.env.QORE_SECRETS_PATH ??
    join(homedir(), "workspace", "qorechain-contest", "foundation-spike", ".secrets", "account.json");
  let mnemonic: string;
  try {
    mnemonic = JSON.parse(readFileSync(secretsPath, "utf8")).mnemonic;
  } catch {
    fail(`could not read secrets file at ${secretsPath} (set QORE_SECRETS_PATH)`);
  }
  if (!mnemonic) fail("secrets file has no mnemonic");

  // --- derive the signer (SDK account + canonical PQC keypair) ---
  const acc = await deriveUnifiedAccount(mnemonic, signerIndex);
  if (signerIndex === 0 && acc.cosmos !== EXPECTED_IDX0_COSMOS) {
    fail("derived index-0 account does not match the expected deployer — wrong secrets file");
  }
  const pqc = derivePqcCanonical(acc.cosmos, mnemonic);
  console.log(`signer: idx${signerIndex} cosmos=${acc.cosmos} evm=${acc.evm}`);

  const provider = new ethers.JsonRpcProvider(EVM_RPC);
  const escrow = new ethers.Contract(CONTRACT, ESCROW_ABI, provider);
  const keyStatus = new ethers.Contract(PQC_KEY_STATUS, KEY_STATUS_ABI, provider);
  const verifier = new ethers.Contract(PQC_VERIFY, VERIFY_ABI, provider);

  // --- escrow state + signer role ---
  const esc = await escrow.getEscrow(escrowId);
  const status = Number(esc.status);
  if (status !== 1) fail(`escrow ${escrowId} is not Funded (status=${status}); nothing to approve`);
  if (esc.frozen) fail(`escrow ${escrowId} is frozen`);
  const role =
    acc.evm.toLowerCase() === String(esc.buyer).toLowerCase()
      ? "buyer"
      : acc.evm.toLowerCase() === String(esc.seller).toLowerCase()
        ? "seller"
        : null;
  if (!role) fail(`signer ${acc.evm} is neither buyer nor seller of escrow ${escrowId}`);
  const tranche = esc.currentTranche as bigint;
  const nonce = esc.approvalNonce as bigint;
  if (expectedTranche !== undefined && expectedTranche !== tranche) {
    fail(`expected tranche ${expectedTranche} but escrow ${escrowId} is at tranche ${tranche}`);
  }
  if (await escrow.trancheApprovals(escrowId, tranche, acc.evm)) {
    fail(`${role} approval for tranche ${tranche} is already recorded on chain`);
  }
  console.log(`escrow ${escrowId}: role=${role} tranche=${tranche} nonce=${nonce}`);

  // --- pqcKeyStatus pre-flight (0x0A02) ---
  const st = await keyStatus.pqcKeyStatus(acc.evm);
  const pubkeyMatch =
    ethers.keccak256(st.pubkey as string) === ethers.keccak256(ethers.hexlify(pqc.publicKey));
  console.log(
    `pqcKeyStatus: registered=${st.registered} alg=${Number(st.algorithmId)} proven=${st.possessionProven} pubkeyMatch=${pubkeyMatch}`,
  );
  if (!st.registered || !st.possessionProven || Number(st.algorithmId) !== 1 || !pubkeyMatch) {
    fail("signer's on-chain PQC key status is not clean — no tx sent");
  }

  // --- scoped EVM window budget (the broadcast must fit the window) ---
  const win = await (await fetch(`${REST}/qorechain/pqc/v1/evm_window/${acc.cosmos}`)).json();
  console.log(`evm window: live=${win.live} remaining_txs=${win.remaining_txs}`);
  if (!win.live || BigInt(win.remaining_txs) < 1n) {
    fail("signer's EVM window is not live or has no transactions remaining — no tx sent");
  }

  // --- digest, exactly as the contract builds it ---
  const block = await provider.getBlock("latest");
  if (!block) fail("could not fetch the latest block");
  const deadline = BigInt(block.timestamp) + DEADLINE_SECONDS;
  const msgHash: string = await escrow.actionMessage(escrowId, ACTION, tranche, nonce, deadline);
  console.log(`actionMessage digest: ${msgHash} (deadline ${deadline})`);

  // --- ML-DSA-87 signature via the QoreChain SDK, cross-checked with @qorechain/pqc ---
  const msgBytes = ethers.getBytes(msgHash);
  const sig = pqcSign(pqc.secretKey, msgBytes);
  console.log(`signature: ${sig.length} bytes`);
  if (!mldsa87.verify(pqc.publicKey, msgBytes, sig)) {
    fail("local ML-DSA-87 verification (@qorechain/pqc) failed — NOT broadcasting");
  }
  console.log("local ML-DSA-87 verification (@qorechain/pqc mldsa87.verify): OK");

  // --- pre-flight against the live pqcVerify precompile (0x0A01) ---
  const ok: boolean = await verifier.pqcVerify(
    ethers.hexlify(pqc.publicKey),
    ethers.hexlify(sig),
    msgHash,
  );
  console.log(`preflight pqcVerify(pubkey, sig, digest) = ${ok}`);
  if (!ok) fail("pre-flight pqcVerify returned false — NOT broadcasting");

  // --- broadcast approveRelease from the signer's EVM account ---
  const pk = acc.privateKey.startsWith("0x") ? acc.privateKey : `0x${acc.privateKey}`;
  const wallet = new ethers.Wallet(pk, provider);
  if (wallet.address.toLowerCase() !== acc.evm.toLowerCase()) fail("derived EVM key mismatch");
  const escrowWrite = new ethers.Contract(CONTRACT, ESCROW_ABI, wallet);
  const tx = await escrowWrite.approveRelease(
    escrowId,
    ethers.hexlify(pqc.publicKey),
    ethers.hexlify(sig),
    deadline,
  );
  console.log(`approveRelease tx: ${tx.hash}`);
  const rcpt = await tx.wait();
  if (!rcpt || rcpt.status !== 1) fail(`approveRelease reverted on chain (tx ${tx.hash})`);

  // --- read back the result ---
  const recorded = await escrow.trancheApprovals(escrowId, tranche, acc.evm);
  const after = await escrow.getEscrow(escrowId);
  console.log(
    `approval recorded: ${recorded}; escrow now: released=${after.releasedAmount} remaining=${after.remainingAmount} tranche=${after.currentTranche} status=${Number(after.status)}`,
  );
  if (!recorded) fail("approval was not recorded on chain despite a successful tx");
  console.log("APPROVE_COMPLETE");
}

main().catch((e) => {
  console.error("ERROR:", e?.shortMessage ?? e?.message ?? String(e));
  process.exit(1);
});
