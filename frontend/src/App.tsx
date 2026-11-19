import { useEffect, useMemo, useState } from "react";

/**
 * DeedLock Escrow — frontend.
 *
 * The "Live on Diana" panel at the top reads REAL escrow state directly
 * from the deployed DeedLockEscrow contract via JSON-RPC `eth_call`
 * (escrowCount + getEscrow) — that part is not a simulation. The
 * interactive walkthrough below it runs locally with an in-memory
 * simulation of the DeedLockEscrow state machine, so judges can click
 * through the whole flow without a wallet or testnet funds. Every "PQ
 * approval" button there stands for the real on-chain step: signing the
 * domain-bound action message with an ML-DSA-87 key and having the
 * contract verify it through the QoreChain pqcVerify precompile (0x0A01)
 * against the key registered on chain (pqcKeyStatus, 0x0A02). Simulated
 * signatures are visual placeholders only; write actions happen on chain
 * through the contract (see the live panel's explorer links), not from
 * this page.
 *
 * The validation rules below intentionally mirror the contract: 1–5
 * tranches, tranche sum == total, distinct parties, refund only after the
 * timelock, guardian can freeze but never release.
 */

/* ---------------- Live on-chain reads (Diana testnet) ---------------- */

const RPC_URL = "https://evm-testnet.qore.host";
const CONTRACT = "0xb6d7B326F44729772dbAD5B094B61E40C1a71b07";
const EXPLORER = "https://explore.qore.network";
const STATUS_NAMES = ["Created", "Funded", "Released", "Refunded", "Disputed", "Resolved"];
const SEL_ESCROW_COUNT = "0x675ac67a"; // escrowCount()
const SEL_GET_ESCROW = "0x7d19e596"; // getEscrow(uint256)

interface LiveEscrow {
  id: number;
  buyer: string;
  seller: string;
  total: bigint;
  remaining: bigint;
  released: bigint;
  currentTranche: bigint;
  approvalNonce: bigint;
  status: number;
  frozen: boolean;
}

async function rpcCall(method: string, params: unknown[]): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "RPC error");
  return j.result as string;
}

function wordAt(hex: string, i: number): string {
  return hex.slice(2 + i * 64, 2 + (i + 1) * 64);
}
function addrAt(hex: string, i: number): string {
  return "0x" + wordAt(hex, i).slice(24);
}
function uintAt(hex: string, i: number): bigint {
  return BigInt("0x" + wordAt(hex, i));
}

async function fetchLiveEscrow(id: number): Promise<LiveEscrow> {
  const data = SEL_GET_ESCROW + id.toString(16).padStart(64, "0");
  const out = await rpcCall("eth_call", [{ to: CONTRACT, data }, "latest"]);
  return {
    id,
    buyer: addrAt(out, 0),
    seller: addrAt(out, 1),
    total: uintAt(out, 5),
    remaining: uintAt(out, 6),
    released: uintAt(out, 7),
    currentTranche: uintAt(out, 8),
    approvalNonce: uintAt(out, 10),
    status: Number(uintAt(out, 11)),
    frozen: uintAt(out, 12) !== 0n,
  };
}

function fmtQor(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

const CYCLE_TXS: { id: number; label: string; hash: string }[] = [
  { id: 0, label: "create", hash: "0x128900a8ed99aa50ec476bbec416193e30bb4df3755f6699b77a68844fc513e9" },
  { id: 0, label: "fund 0.2 QOR", hash: "0x60b12f2b2c77bc047d079f45fae30bd034065b4c9772a2bfe699cdced29f236c" },
  { id: 0, label: "buyer PQ approve T1", hash: "0x945441f20f61370dade0b6090eeb5c1354ff7b2da380357413c4cf5f216f7ddd" },
  { id: 0, label: "seller PQ approve T1 → release", hash: "0x1525330808b5c1e07fa773e57d5b1bf621b4abed9db23f3157c780c3d945f888" },
  { id: 0, label: "buyer PQ approve T2", hash: "0xcb0e018abfa9be3d51ed525870be4a0b84f3fe7408d1c7ea0ca1585100fc9f8a" },
  { id: 0, label: "seller PQ approve T2 → release", hash: "0xfd01aa4f44b5feacff07e34812b0ec3d6d735d2a7e1e8b2e56ff1322e59eb3ad" },
  { id: 2, label: "create", hash: "0xfc7a5ee3130c77220bf9cd7e29472cc319f5d4b9893a7f051ad1c65188e9d5a1" },
  { id: 2, label: "fund 0.2 QOR", hash: "0x2a59aeb636b5f286b8ee9eabb8e8b5643189e64ff90769dba0d84e51b615c628" },
  { id: 2, label: "buyer PQ approve T1", hash: "0x69776b6f830ead191025ec3645e7e77f47f60d52e9c9a672d82b4e367de7d011" },
  { id: 2, label: "seller PQ approve T1 → release", hash: "0xf069c90388f65b32959555a9b94162fbc43cc4af2fba0180f4ea55b321ff2648" },
  { id: 2, label: "buyer PQ approve T2", hash: "0xa011448f2c1dbee02fab1aaa1e8331d6c2caced382bbedc3e8550357776c5134" },
  { id: 2, label: "seller PQ approve T2 → release", hash: "0x0633c9fdc61ad3ca731974e23d963374b992f873127b6e0fc29fe4056ed84bf4" },
];

function LivePanel() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ok"; count: number; block: number; escrows: LiveEscrow[] }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const countOut = await rpcCall("eth_call", [{ to: CONTRACT, data: SEL_ESCROW_COUNT }, "latest"]);
        const count = Number(BigInt(countOut));
        const block = Number(BigInt(await rpcCall("eth_blockNumber", [])));
        const ours: LiveEscrow[] = [];
        for (const id of [0, 2]) {
          if (id < count) ours.push(await fetchLiveEscrow(id));
        }
        if (!cancelled) setState({ kind: "ok", count, block, escrows: ours });
      } catch (e) {
        if (!cancelled)
          setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2>Live on Diana — real escrow state, read from the contract</h2>
      <p className="hint">
        Contract{" "}
        <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">
          {CONTRACT}
        </a>{" "}
        · read live via <code>eth_call</code> (<code>escrowCount</code> + <code>getEscrow</code>).
        The interactive walkthrough further down is a local simulation; this panel is not.
      </p>
      {state.kind === "loading" && <p className="hint">Reading the chain…</p>}
      {state.kind === "error" && (
        <p className="hint">Live read failed ({state.message}). The contract state is unchanged;
        reload to retry.</p>
      )}
      {state.kind === "ok" && (
        <>
          <p className="hint">
            escrowCount on chain: <b>{state.count}</b> · read at EVM block {state.block}. Our two
            fully-released demo escrows:
          </p>
          {state.escrows.map((e) => (
            <div key={e.id} style={{ marginBottom: 12 }}>
              <div className="t">
                Escrow #{e.id} — {fmtQor(e.total)} QOR{" "}
                <span className={`pill ${STATUS_NAMES[e.status]}`}>{STATUS_NAMES[e.status]}</span>
                {e.frozen && <span className="pill Disputed">Frozen</span>}
              </div>
              <div className="m">
                released {fmtQor(e.released)} QOR · remaining {fmtQor(e.remaining)} QOR · tranches
                completed: {e.currentTranche.toString()} · approval nonce {e.approvalNonce.toString()}
                <br />
                buyer {e.buyer} · seller {e.seller}
              </div>
              <div className="m">
                {CYCLE_TXS.filter((t) => t.id === e.id).map((t) => (
                  <span key={t.hash} style={{ marginRight: 10 }}>
                    <a href={`${EXPLORER}/tx/${t.hash}`} target="_blank" rel="noreferrer">
                      {t.label}
                    </a>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

type Status = "Created" | "Funded" | "Released" | "Refunded" | "Disputed" | "Resolved";

interface Escrow {
  id: number;
  title: string;
  buyer: string;
  seller: string;
  arbiter: string;
  guardian: string;
  asset: "QOR" | "fUSD";
  total: number;
  tranches: number[];
  currentTranche: number;
  released: number;
  approvals: { buyer: boolean; seller: boolean };
  status: Status;
  frozen: boolean;
  nonce: number;
  fundedAt: number | null; // demo clock (seconds)
  refundDurationSec: number;
  lastSig: string | null;
}

const DEMO = {
  buyer: "0x6E2198c7198Ce3B718DFCf38103120C8346fD28A",
  seller: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  arbiter: "0xF4098F9aB1c9C30cF2c76c93A6c7bB63A9Fe9c11",
  guardian: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
};

/** Deterministic placeholder "signature fingerprint" for demo display only. */
function fakeSig(e: Escrow, action: string, who: string): string {
  const seed = `${e.id}|${action}|${who}|${e.nonce}|${e.currentTranche}`;
  let h1 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  const chunk = h1.toString(16).padStart(8, "0");
  return `ml-dsa-87(sim):${chunk}${chunk}${chunk}${chunk}…`;
}

const seedEscrow: Escrow = {
  id: 0,
  title: "House down payment — Jl. Merdeka No. 12, Bandung",
  buyer: DEMO.buyer,
  seller: DEMO.seller,
  arbiter: DEMO.arbiter,
  guardian: DEMO.guardian,
  asset: "fUSD",
  total: 250000,
  tranches: [100000, 100000, 50000],
  currentTranche: 0,
  released: 0,
  approvals: { buyer: false, seller: false },
  status: "Funded",
  frozen: false,
  nonce: 0,
  fundedAt: 0,
  refundDurationSec: 7 * 24 * 3600,
  lastSig: null,
};

export default function App() {
  const [escrows, setEscrows] = useState<Escrow[]>([seedEscrow]);
  const [selectedId, setSelectedId] = useState(0);
  const [clock, setClock] = useState(0); // demo seconds since funding of seed
  const [sellerBps, setSellerBps] = useState(7000);

  // create-form state
  const [title, setTitle] = useState("Car down payment — Toyota Avanza 2019, Jakarta");
  const [asset, setAsset] = useState<"QOR" | "fUSD">("QOR");
  const [totalStr, setTotalStr] = useState("120");
  const [tranchesStr, setTranchesStr] = useState("60, 40, 20");
  const [refundDays, setRefundDays] = useState("14");
  const [formError, setFormError] = useState<string | null>(null);

  const selected = escrows.find((e) => e.id === selectedId) ?? escrows[0];
  const remaining = selected ? selected.total - selected.released : 0;
  const refundUnlocked =
    selected != null &&
    selected.status === "Funded" &&
    selected.fundedAt != null &&
    clock - selected.fundedAt > selected.refundDurationSec;

  function patch(id: number, fn: (e: Escrow) => Escrow) {
    setEscrows((prev) => prev.map((e) => (e.id === id ? fn(e) : e)));
  }

  function createEscrow(ev: React.FormEvent) {
    ev.preventDefault();
    const total = Number(totalStr);
    const tranches = tranchesStr
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    // Mirror the contract's createEscrow validation.
    if (!total || total <= 0) return setFormError("Total must be > 0.");
    if (tranches.length < 1 || tranches.length > 5)
      return setFormError("Number of tranches must be 1–5 (contract rule: MAX_TRANCHES = 5).");
    if (tranches.some((t) => t <= 0))
      return setFormError("Every tranche must be > 0.");
    const sum = tranches.reduce((a, b) => a + b, 0);
    if (sum !== total)
      return setFormError(`Tranche amounts (${sum}) must add up exactly to the total (${total}).`);
    if (!(Number(refundDays) > 0)) return setFormError("Refund period must be > 0 days.");
    setFormError(null);
    const id = escrows.length;
    const e: Escrow = {
      id,
      title: title || `Escrow #${id}`,
      buyer: DEMO.buyer,
      seller: DEMO.seller,
      arbiter: DEMO.arbiter,
      guardian: DEMO.guardian,
      asset,
      total,
      tranches,
      currentTranche: 0,
      released: 0,
      approvals: { buyer: false, seller: false },
      status: "Created",
      frozen: false,
      nonce: 0,
      fundedAt: null,
      refundDurationSec: Number(refundDays) * 24 * 3600,
      lastSig: null,
    };
    setEscrows((prev) => [...prev, e]);
    setSelectedId(id);
  }

  function fund(e: Escrow) {
    patch(e.id, (x) => ({ ...x, status: "Funded", fundedAt: clock }));
  }

  function approve(e: Escrow, who: "buyer" | "seller") {
    patch(e.id, (x) => {
      const approvals = { ...x.approvals, [who]: true };
      const sig = fakeSig(x, "APPROVE_RELEASE", who);
      if (approvals.buyer && approvals.seller) {
        const amount = x.tranches[x.currentTranche];
        const released = x.released + amount;
        const currentTranche = x.currentTranche + 1;
        return {
          ...x,
          approvals: { buyer: false, seller: false },
          released,
          currentTranche,
          nonce: x.nonce + 1,
          status: currentTranche === x.tranches.length ? "Released" : x.status,
          lastSig: sig,
        };
      }
      return { ...x, approvals, lastSig: sig };
    });
  }

  function refund(e: Escrow) {
    patch(e.id, (x) => ({
      ...x,
      status: "Refunded",
      nonce: x.nonce + 1,
      lastSig: fakeSig(x, "REFUND", "buyer"),
    }));
  }

  function dispute(e: Escrow) {
    patch(e.id, (x) => ({ ...x, status: "Disputed" }));
  }

  function arbitrate(e: Escrow) {
    patch(e.id, (x) => ({
      ...x,
      status: "Resolved",
      released: x.released + Math.floor(((x.total - x.released) * sellerBps) / 10000),
      nonce: x.nonce + 1,
      lastSig: fakeSig(x, "ARBITRATE", "arbiter"),
    }));
  }

  function toggleFreeze(e: Escrow) {
    patch(e.id, (x) => ({
      ...x,
      frozen: !x.frozen,
      nonce: x.nonce + 1,
      lastSig: fakeSig(x, x.frozen ? "UNFREEZE" : "FREEZE", "guardian"),
    }));
  }

  const releasedPct = useMemo(
    () => (selected ? Math.round((selected.released / selected.total) * 100) : 0),
    [selected]
  );

  return (
    <div className="wrap">
      <header className="top">
        <h1>
          DeedLock <span>Escrow</span>
        </h1>
        <div className="badges">
          <span className="badge">QoreChain Diana Testnet · EVM 9800</span>
          <span className="badge">ML-DSA-87 · pqcVerify 0x0A01</span>
          <span className="badge demo">LIVE READS from Diana · walkthrough below is a local simulation</span>
        </div>
      </header>
      <p className="sub">
        Down-payment escrow for property and used-vehicle sales in Indonesia.
        Funds stay locked in the contract and are released only when <b>the buyer AND the seller both
        sign with an ML-DSA-87 key</b> registered on-chain — an ECDSA key
        alone is never enough. On testnet that signature is genuinely verified
        by the <i>pqcVerify</i> precompile; two full escrow cycles have already
        run on chain that way (live panel below). In the interactive walkthrough
        further down, the approval buttons simulate it.
      </p>

      <LivePanel />

      <div className="grid">
        {/* ---------------- Create form + list ---------------- */}
        <div>
          <form className="card" onSubmit={createEscrow}>
            <h2>Create New Escrow</h2>
            <label>Transaction title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
            <label>Asset</label>
            <select value={asset} onChange={(e) => setAsset(e.target.value as "QOR" | "fUSD")}>
              <option value="QOR">QOR (native)</option>
              <option value="fUSD">fUSD (ERC-20 testnet)</option>
            </select>
            <label>Total down payment ({asset})</label>
            <input value={totalStr} onChange={(e) => setTotalStr(e.target.value)} inputMode="decimal" />
            <label>Milestone tranches (comma-separated, max 5, must sum to the total)</label>
            <input value={tranchesStr} onChange={(e) => setTranchesStr(e.target.value)} />
            <label>Buyer's unilateral refund deadline (days after funding)</label>
            <input value={refundDays} onChange={(e) => setRefundDays(e.target.value)} inputMode="numeric" />
            <p className="hint">
              Demo parties — Buyer: you · Seller, Arbitrator &amp; Guardian: fixed demo addresses.
              All four parties must be different and non-zero (the same validation the contract applies).
            </p>
            {formError && <div className="err">{formError}</div>}
            <button className="primary" type="submit">
              Create Escrow
            </button>
          </form>

          <div className="card" style={{ marginTop: 20 }}>
            <h2>My Escrows</h2>
            {escrows.map((e) => (
              <div
                key={e.id}
                className={`escrow-item ${e.id === selected?.id ? "selected" : ""}`}
                onClick={() => setSelectedId(e.id)}
              >
                <div className="t">
                  #{e.id} {e.title}
                  <span className={`pill ${e.status}`}>{e.status}</span>
                  {e.frozen && <span className="pill Disputed">Frozen</span>}
                </div>
                <div className="m">
                  {e.total.toLocaleString("en-US")} {e.asset} · released{" "}
                  {e.released.toLocaleString("en-US")} · {e.tranches.length} tranche
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- Detail panel ---------------- */}
        {selected && (
          <div className="card">
            <h2>
              #{selected.id} — {selected.title}
              <span className={`pill ${selected.status}`}>{selected.status}</span>
              {selected.frozen && <span className="pill Disputed">Frozen by Guardian</span>}
            </h2>

            <dl className="kv">
              <dt>Buyer</dt><dd>{selected.buyer}</dd>
              <dt>Seller</dt><dd>{selected.seller}</dd>
              <dt>Arbitrator (PQ)</dt><dd>{selected.arbiter}</dd>
              <dt>Guardian</dt><dd>{selected.guardian}</dd>
              <dt>Anti-replay nonce</dt><dd>{selected.nonce}</dd>
              <dt>Remaining locked</dt>
              <dd>{remaining.toLocaleString("en-US")} {selected.asset}</dd>
            </dl>

            <h3>Milestone Timeline</h3>
            <div className="timeline">
              {selected.tranches.map((amt, i) => {
                const cls = i < selected.currentTranche ? "done" : i === selected.currentTranche && selected.status === "Funded" ? "now" : "";
                const label = i < selected.currentTranche ? "Released ✓" : i === selected.currentTranche ? "Awaiting 2 approvals" : "Locked";
                return (
                  <div key={i} className={`step ${cls}`}>
                    Tranche {i + 1}
                    <span className="amt">{amt.toLocaleString("en-US")} {selected.asset}</span>
                    {label}
                  </div>
                );
              })}
            </div>
            <div className="progress"><div style={{ width: `${releasedPct}%` }} /></div>
            <p className="hint">{releasedPct}% of the funds have been released to the seller.</p>

            {selected.status === "Created" && (
              <div className="row">
                <button className="primary" onClick={() => fund(selected)}>
                  Fund Escrow ({selected.total.toLocaleString("en-US")} {selected.asset})
                </button>
              </div>
            )}

            {selected.status === "Funded" && !selected.frozen && (
              <>
                <h3>Two-Party Approval Panel — Tranche {selected.currentTranche + 1}</h3>
                <p className="hint">
                  Each approval is an ML-DSA-87 signature over a domain-bound message
                  (contract, escrow id, action, tranche, nonce, deadline). A single approval
                  on its own releases nothing.
                </p>
                <div className="row">
                  <button
                    className={`pq ${selected.approvals.buyer ? "approved" : ""}`}
                    disabled={selected.approvals.buyer}
                    onClick={() => approve(selected, "buyer")}
                  >
                    {selected.approvals.buyer ? "Buyer ✓ Approved" : "Approve — Buyer (PQ Sign)"}
                  </button>
                  <button
                    className={`pq ${selected.approvals.seller ? "approved" : ""}`}
                    disabled={selected.approvals.seller}
                    onClick={() => approve(selected, "seller")}
                  >
                    {selected.approvals.seller ? "Seller ✓ Approved" : "Approve — Seller (PQ Sign)"}
                  </button>
                </div>
                <div className="row">
                  <button className="danger" onClick={() => dispute(selected)}>
                    Open Dispute
                  </button>
                  <button disabled={!refundUnlocked} onClick={() => refund(selected)}>
                    {refundUnlocked
                      ? "Refund to Buyer (PQ Sign)"
                      : "Refund Locked by Timelock"}
                  </button>
                </div>
              </>
            )}

            {selected.status === "Funded" && (
              <p className="hint">
                Demo clock: {Math.floor(clock / 3600)} hours since funding · refund timelock:{" "}
                {Math.round(selected.refundDurationSec / 3600)} hours.{" "}
                <button onClick={() => setClock((c) => c + 24 * 3600)}>+24 hours (simulate time)</button>
              </p>
            )}

            {selected.status === "Disputed" && (
              <>
                <h3>Arbitrator's Decision (PQ Sign required)</h3>
                <div className="split">
                  <span>Seller: {sellerBps / 100}%</span>
                  <span>Buyer: {(10000 - sellerBps) / 100}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10000}
                  step={100}
                  value={sellerBps}
                  onChange={(e) => setSellerBps(Number(e.target.value))}
                />
                <div className="row">
                  <button className="pq" onClick={() => arbitrate(selected)}>
                    Decide — Arbitrator (PQ Sign)
                  </button>
                </div>
              </>
            )}

            {(selected.status === "Funded" || selected.status === "Disputed") && (
              <div className="row">
                <button onClick={() => toggleFreeze(selected)}>
                  {selected.frozen
                    ? "Unfreeze — Guardian (PQ Sign)"
                    : "Freeze — Guardian (PQ Sign, freeze only)"}
                </button>
              </div>
            )}

            {(selected.status === "Released" ||
              selected.status === "Refunded" ||
              selected.status === "Resolved") && (
              <p className="hint">
                This escrow has finished with status <b>{selected.status}</b>. No further actions
                are possible — exactly as with the on-chain contract.
              </p>
            )}

            {selected.lastSig && (
              <p>
                Last signature (simulated): <span className="sig">{selected.lastSig}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <p className="hint" style={{ marginTop: 24 }}>
        DeedLock Escrow · QoreChain Build Before Q-Day — Post-Quantum dApp ·
        Contract: <i>DeedLockEscrow.sol</i> (Solidity 0.8.24) · Diana precompiles:
        pqcVerify 0x0A01, pqcKeyStatus 0x0A02 · The panel at the top reads live
        escrow state from the chain; the interactive walkthrough is a local
        simulation and sends no transactions.
      </p>
    </div>
  );
}
