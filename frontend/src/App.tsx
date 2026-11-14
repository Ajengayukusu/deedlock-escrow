import { useMemo, useState } from "react";

/**
 * DeedLock Escrow — frontend (DEMO MODE).
 *
 * This build runs fully locally with an in-memory simulation of the
 * DeedLockEscrow state machine, so judges can click through the whole flow
 * without a wallet or testnet funds. Every "PQ approval" button here stands
 * for the real on-chain step: signing the domain-bound action message with
 * an ML-DSA-87 key and having the contract verify it through the QoreChain
 * pqcVerify precompile (0x0A01) against the key registered on chain
 * (pqcKeyStatus, 0x0A02). Demo signatures are visual placeholders only.
 *
 * The validation rules below intentionally mirror the contract: 1–5
 * tranches, tranche sum == total, distinct parties, refund only after the
 * timelock, guardian can freeze but never release.
 */

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
  title: "DP Rumah — Jl. Merdeka No. 12, Bandung",
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
  const [title, setTitle] = useState("DP Mobil — Toyota Avanza 2019, Jakarta");
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
    if (!total || total <= 0) return setFormError("Total harus > 0.");
    if (tranches.length < 1 || tranches.length > 5)
      return setFormError("Jumlah tranche harus 1–5 (aturan kontrak: MAX_TRANCHES = 5).");
    if (tranches.some((t) => t <= 0))
      return setFormError("Setiap tranche harus > 0.");
    const sum = tranches.reduce((a, b) => a + b, 0);
    if (sum !== total)
      return setFormError(`Jumlah tranche (${sum}) harus persis sama dengan total (${total}).`);
    if (!(Number(refundDays) > 0)) return setFormError("Durasi refund harus > 0 hari.");
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
          <span className="badge demo">MODE DEMO — simulasi lokal, tanpa chain</span>
        </div>
      </header>
      <p className="sub">
        Escrow uang muka (DP) jual-beli properti &amp; kendaraan bekas di Indonesia.
        Dana terkunci di kontrak dan hanya cair bila <b>pembeli DAN penjual sama-sama
        menandatangani dengan kunci ML-DSA-87</b> yang terdaftar on-chain — kunci
        ECDSA saja tidak pernah cukup. Di testnet, tanda tangan itu diverifikasi
        asli oleh precompile <i>pqcVerify</i>; di demo ini tombol approval adalah
        simulasinya.
      </p>

      <div className="grid">
        {/* ---------------- Create form + list ---------------- */}
        <div>
          <form className="card" onSubmit={createEscrow}>
            <h2>Buat Escrow Baru</h2>
            <label>Judul transaksi</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
            <label>Aset</label>
            <select value={asset} onChange={(e) => setAsset(e.target.value as "QOR" | "fUSD")}>
              <option value="QOR">QOR (native)</option>
              <option value="fUSD">fUSD (ERC-20 testnet)</option>
            </select>
            <label>Total DP ({asset})</label>
            <input value={totalStr} onChange={(e) => setTotalStr(e.target.value)} inputMode="decimal" />
            <label>Tranche milestone (pisahkan koma, maks 5, jumlah = total)</label>
            <input value={tranchesStr} onChange={(e) => setTranchesStr(e.target.value)} />
            <label>Batas waktu refund sepihak pembeli (hari, setelah dana masuk)</label>
            <input value={refundDays} onChange={(e) => setRefundDays(e.target.value)} inputMode="numeric" />
            <p className="hint">
              Pihak demo — Pembeli: kamu · Penjual, Arbitrator &amp; Guardian: alamat demo tetap.
              Keempat pihak harus berbeda dan bukan alamat nol (sama seperti validasi kontrak).
            </p>
            {formError && <div className="err">{formError}</div>}
            <button className="primary" type="submit">
              Buat Escrow
            </button>
          </form>

          <div className="card" style={{ marginTop: 20 }}>
            <h2>Escrow Saya</h2>
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
                  {e.total.toLocaleString("id-ID")} {e.asset} · cair{" "}
                  {e.released.toLocaleString("id-ID")} · {e.tranches.length} tranche
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
              {selected.frozen && <span className="pill Disputed">Frozen oleh Guardian</span>}
            </h2>

            <dl className="kv">
              <dt>Pembeli</dt><dd>{selected.buyer}</dd>
              <dt>Penjual</dt><dd>{selected.seller}</dd>
              <dt>Arbitrator (PQ)</dt><dd>{selected.arbiter}</dd>
              <dt>Guardian</dt><dd>{selected.guardian}</dd>
              <dt>Nonce anti-replay</dt><dd>{selected.nonce}</dd>
              <dt>Sisa terkunci</dt>
              <dd>{remaining.toLocaleString("id-ID")} {selected.asset}</dd>
            </dl>

            <h3>Timeline Milestone</h3>
            <div className="timeline">
              {selected.tranches.map((amt, i) => {
                const cls = i < selected.currentTranche ? "done" : i === selected.currentTranche && selected.status === "Funded" ? "now" : "";
                const label = i < selected.currentTranche ? "Cair ✓" : i === selected.currentTranche ? "Menunggu 2 approval" : "Terkunci";
                return (
                  <div key={i} className={`step ${cls}`}>
                    Tranche {i + 1}
                    <span className="amt">{amt.toLocaleString("id-ID")} {selected.asset}</span>
                    {label}
                  </div>
                );
              })}
            </div>
            <div className="progress"><div style={{ width: `${releasedPct}%` }} /></div>
            <p className="hint">{releasedPct}% dana sudah cair ke penjual.</p>

            {selected.status === "Created" && (
              <div className="row">
                <button className="primary" onClick={() => fund(selected)}>
                  Danai Escrow ({selected.total.toLocaleString("id-ID")} {selected.asset})
                </button>
              </div>
            )}

            {selected.status === "Funded" && !selected.frozen && (
              <>
                <h3>Panel Approval Dua Pihak — Tranche {selected.currentTranche + 1}</h3>
                <p className="hint">
                  Setiap approval = tanda tangan ML-DSA-87 atas pesan terikat domain
                  (kontrak, id escrow, aksi, tranche, nonce, deadline). Satu approval saja
                  tidak mencairkan apa pun.
                </p>
                <div className="row">
                  <button
                    className={`pq ${selected.approvals.buyer ? "approved" : ""}`}
                    disabled={selected.approvals.buyer}
                    onClick={() => approve(selected, "buyer")}
                  >
                    {selected.approvals.buyer ? "Pembeli ✓ Sudah Approve" : "Approve — Pembeli (PQ Sign)"}
                  </button>
                  <button
                    className={`pq ${selected.approvals.seller ? "approved" : ""}`}
                    disabled={selected.approvals.seller}
                    onClick={() => approve(selected, "seller")}
                  >
                    {selected.approvals.seller ? "Penjual ✓ Sudah Approve" : "Approve — Penjual (PQ Sign)"}
                  </button>
                </div>
                <div className="row">
                  <button className="danger" onClick={() => dispute(selected)}>
                    Ajukan Sengketa
                  </button>
                  <button disabled={!refundUnlocked} onClick={() => refund(selected)}>
                    {refundUnlocked
                      ? "Refund ke Pembeli (PQ Sign)"
                      : "Refund Terkunci oleh Timelock"}
                  </button>
                </div>
              </>
            )}

            {selected.status === "Funded" && (
              <p className="hint">
                Jam demo: {Math.floor(clock / 3600)} jam sejak pendanaan · timelock refund:{" "}
                {Math.round(selected.refundDurationSec / 3600)} jam.{" "}
                <button onClick={() => setClock((c) => c + 24 * 3600)}>+24 jam (simulasi waktu)</button>
              </p>
            )}

            {selected.status === "Disputed" && (
              <>
                <h3>Keputusan Arbitrator (wajib PQ Sign)</h3>
                <div className="split">
                  <span>Penjual: {sellerBps / 100}%</span>
                  <span>Pembeli: {(10000 - sellerBps) / 100}%</span>
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
                    Putuskan — Arbitrator (PQ Sign)
                  </button>
                </div>
              </>
            )}

            {(selected.status === "Funded" || selected.status === "Disputed") && (
              <div className="row">
                <button onClick={() => toggleFreeze(selected)}>
                  {selected.frozen
                    ? "Unfreeze — Guardian (PQ Sign)"
                    : "Freeze — Guardian (PQ Sign, hanya membekukan)"}
                </button>
              </div>
            )}

            {(selected.status === "Released" ||
              selected.status === "Refunded" ||
              selected.status === "Resolved") && (
              <p className="hint">
                Escrow selesai dengan status <b>{selected.status}</b>. Tidak ada aksi
                lanjutan yang mungkin — sama seperti kontrak on-chain.
              </p>
            )}

            {selected.lastSig && (
              <p>
                Signature terakhir (simulasi): <span className="sig">{selected.lastSig}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <p className="hint" style={{ marginTop: 24 }}>
        DeedLock Escrow · QoreChain Build Before Q-Day — Post-Quantum dApp ·
        Kontrak: <i>DeedLockEscrow.sol</i> (Solidity 0.8.24) · Precompile Diana:
        pqcVerify 0x0A01, pqcKeyStatus 0x0A02 · Demo ini tidak terhubung ke chain.
      </p>
    </div>
  );
}
