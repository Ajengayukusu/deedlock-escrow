# VIDEO SCRIPT — DeedLock Escrow (Post-Quantum dApp)

- **Kategori:** Post-Quantum dApp · **Status:** LIVE di Diana (chainId 9800)
- **Kontrak:** `DeedLockEscrow` — `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07`
- **Target durasi:** 2:30–2:55 (maksimum contest 3:00) · **Kecepatan baca acuan:** ~130 kata/menit
- **Jumlah kata narasi:** 358 kata · **Estimasi durasi baca:** ±2:45
- **Bahasa narasi:** Inggris (juri internasional). Hash dibaca bentuk pendek saja; hash lengkap tampil di layar.

## Tabel segmen

| Segmen | Waktu | Durasi | Isi | Kata |
|---|---|---|---|---|
| 1 | 0:00–0:17 | ±17 dtk | Hook — masalah DP hilang | 37 |
| 2 | 0:17–1:45 | ±88 dtk | Demo — buat, danai, 2 approval ML-DSA | 192 |
| 3 | 1:45–2:16 | ±31 dtk | Bukti on-chain di explorer | 67 |
| 4 | 2:16–2:35 | ±19 dtk | Keamanan — signature palsu revert live | 42 |
| 5 | 2:35–2:44 | ±9 dtk | Penutup — syarat kategori | 20 |

---

## Naskah narasi (voice-over)

### [0:00–0:17] Segmen 1 — Hook

> In Indonesia, down payments for houses and used cars vanish every week — sellers disappear, and buyers are pressured to release money before the deed changes hands. DeedLock Escrow locks the down payment behind two post-quantum signatures.

### [0:17–1:45] Segmen 2 — Demo alur utama

> Here is the demo frontend, simulating the exact contract state machine. A buyer creates an escrow for a property down payment: seller, arbiter, guardian, and a milestone schedule — two tranches of zero point one QOR that must sum exactly to the funded total, so over-release is impossible by construction. The buyer funds it, and the escrow locks. Now the key moment: releasing a tranche needs two approvals — and not from msg.sender alone. Each approval is a fresh ML-DSA-87 signature over a domain-bound message containing the contract, the escrow, the action, the tranche, a nonce, and a deadline. The contract checks the signer against the pqcKeyStatus precompile — registered, possession proven, algorithm ML-DSA-87 — then verifies the signature with the pqcVerify precompile against the key actually registered on-chain. The buyer approves. The seller approves. Only then does the tranche move. A guardian can freeze a disputed escrow, but freezing can never move funds; an arbiter resolves disputes with the same post-quantum gate. And this exact flow already ran on Diana — not a mock: real keys, real precompiles, real funds — in the next shot we verify it on the explorer.

### [1:45–2:16] Segmen 3 — Bukti on-chain

> On the explorer: the contract, deployed in transaction e6baa8…3b81. The escrow was created, funded with zero point two QOR, approved by the buyer's ML-DSA key, then by the seller's — and that second approval released tranche one: zero point one QOR to the seller. Read the state now: tranche one of two released, one approval nonce consumed, zero point one QOR still locked for the next milestone.

### [2:16–2:35] Segmen 4 — Keamanan

> We also attacked it live. An approval carrying the buyer's real public key but a garbage signature was broadcast — and reverted on-chain with PqcBadSignature. Forty-four tests cover ECDSA-only approvals, key swaps, replay, expired deadlines, and a guardian trying to pay out.

### [2:35–2:44] Segmen 5 — Penutup

> DeedLock Escrow: down payments that only two post-quantum signatures can release — live on Diana for the Post-Quantum dApp track.

---

## Shot list per segmen

**Segmen 1 — Hook (0:00–0:17)**
- Layar: featured image project, lalu halaman depan frontend DeedLock (daftar escrow kosong/baru).
- Teks overlay singkat: "DP hilang → dana terkunci 2 tanda tangan ML-DSA-87".

**Segmen 2 — Demo (0:17–1:45)**
- Layar: frontend demo lokal (`cd frontend && npm run dev`, http://localhost:5173) — mode demo meniru state machine kontrak persis.
- Klik: **Create Escrow** — isi buyer/seller/arbiter/guardian + jadwal 2 tranche (0,1 + 0,1 QOR); tampilkan validasi "schedule must sum to total".
- Klik **Fund** (0,2 QOR) → status Funded, timeline milestone tampil.
- Panel approval: **Approve (Buyer)** lalu **Approve (Seller)** — sorot panel pesan yang di-sign (domain: contract, escrowId, action, tranche, nonce, deadline) dan status kunci (registered + possessionProven) di UI.
- Setelah approval kedua: tranche 1 berubah **Released**, saldo seller bertambah; berhenti 1 detik di event/timeline.
- Sentuh singkat panel Dispute/Freeze saat narasi menyebut guardian/arbiter.

**Segmen 3 — Bukti on-chain (1:45–2:16)**
- Layar: explorer https://explore.qore.network (Testnet) — kontrak `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07`, tx deploy `0xe6baa83e…3b81`.
- Buka berurutan: create `0x128900a8…513e9`, fund `0x60b12f2b…9f236c`, buyer approve `0x945441f2…7ddd`, seller approve `0x15253308…f888` — tunjukkan di tx seller ada log **TrancheApproved + TrancheReleased**.
- Read state escrow 0: releasedAmount 0,1 QOR, remainingAmount 0,1 QOR, currentTranche 1, approvalNonce 1 (dari explorer read atau `deployments.testnet.json` di editor).

**Segmen 4 — Keamanan (2:16–2:35)**
- Layar: explorer — tx negatif `0x9e496f6521e657efc61c7ce9c49a39703e306cad9bb50fc26d5b7db27dfa6da6` dengan status **reverted** (gasUsed 300.000); overlay teks error `PqcBadSignature` (dari simulasi eth_call).
- Potong ke terminal: `npx hardhat test` → "44 passing", sorot grup test ATTACK.

**Segmen 5 — Penutup (2:35–2:44)**
- Layar: halaman escrow demo (tranche 1 Released) + alamat kontrak; fade out.

---

## Aset yang disiapkan sebelum rekam

1. Tab explorer (Testnet) terbuka di: kontrak `0xb6d7B326F44729772dbAD5B094B61E40C1a71b07`; tx deploy `0xe6baa83e…3b81`; tx seller approve `0x15253308…f888` (log TrancheReleased); tx negatif revert `0x9e496f65…da6`.
2. Bukti register kunci kedua pihak siap tampil: native tx buyer `84EBDFC9…7CCC`, seller `183639CE…8291` (REST: `https://api-testnet.qore.host/cosmos/tx/v1beta1/txs/<HASH>`), dan window seller `D10F6B03…A886`.
3. Frontend demo lokal berjalan (port 5173), state di-reset; satu run demo cadangan sudah direkam.
4. Terminal siap: `npx hardhat test` di root project untuk shot "44 passing".
5. `deployments.testnet.json` terbuka di bagian `escrowDemo.finalState` + `negativeLiveTest` untuk shot verifikasi angka.
6. Clipboard berurutan: alamat kontrak → hash deploy → hash seller approve → hash negatif.
7. Catatan jujur yang TIDAK boleh diklaim di video: audit QCAI dashboard dua tahap belum dijalankan (lihat `audit/QCAI_AUDIT_PLAN.md`) — narasi memang tidak menyebutkannya; jangan improvisasi klaim audit.
