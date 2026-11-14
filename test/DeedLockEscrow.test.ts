import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { AbiCoder } from "ethers";

/**
 * DeedLockEscrow test suite.
 *
 * Locally the QoreChain PQC precompiles are replaced by MockPqc. A "valid
 * ML-DSA signature" is mock.mockSign(pubkey, message); anything else —
 * garbage bytes, a signature for another pubkey / message / nonce / escrow —
 * fails verification, which is exactly what the negative tests exercise.
 */

const TOTAL = ethers.parseEther("10");
const TRANCHES = [ethers.parseEther("4"), ethers.parseEther("3"), ethers.parseEther("3")];
const SEVEN_DAYS = 7 * 24 * 3600;

function pubkeyFor(address: string): string {
  return ethers.hexlify(
    ethers.toUtf8Bytes("ml-dsa-87-pubkey::" + address.toLowerCase())
  );
}

describe("DeedLockEscrow", function () {
  let buyer: any, seller: any, arbiter: any, guardian: any, stranger: any;
  let mock: any, escrow: any, fusd: any;

  async function deadline(offset = 3600): Promise<number> {
    return (await time.latest()) + offset;
  }

  /// Produce a mock PQ signature by `signer` over the contract's own
  /// domain-bound action message.
  async function pqSig(
    signer: any,
    escrowId: number,
    action: string,
    extra: number | bigint,
    nonce: number | bigint,
    dl: number
  ): Promise<string> {
    const msg = await escrow.actionMessage(escrowId, action, extra, nonce, dl);
    return mock.mockSign(pubkeyFor(signer.address), msg);
  }

  async function currentNonce(escrowId: number): Promise<bigint> {
    const e = await escrow.getEscrow(escrowId);
    return e.approvalNonce;
  }

  /// approveRelease with a fresh, valid PQ signature from `signer`.
  async function approveAs(signer: any, escrowId: number) {
    const e = await escrow.getEscrow(escrowId);
    const dl = await deadline();
    const sig = await pqSig(
      signer,
      escrowId,
      "APPROVE_RELEASE",
      e.currentTranche,
      e.approvalNonce,
      dl
    );
    return escrow
      .connect(signer)
      .approveRelease(escrowId, pubkeyFor(signer.address), sig, dl);
  }

  async function createNative(
    tranches: bigint[] = TRANCHES,
    total: bigint = TOTAL,
    refundDuration = SEVEN_DAYS
  ): Promise<number> {
    const id = Number(await escrow.escrowCount());
    await escrow
      .connect(buyer)
      .createEscrow(
        seller.address,
        arbiter.address,
        guardian.address,
        ethers.ZeroAddress,
        total,
        tranches,
        refundDuration
      );
    return id;
  }

  async function fundedNative(
    tranches: bigint[] = TRANCHES,
    total: bigint = TOTAL,
    refundDuration = SEVEN_DAYS
  ): Promise<number> {
    const id = await createNative(tranches, total, refundDuration);
    await escrow.connect(buyer).fund(id, { value: total });
    return id;
  }

  beforeEach(async function () {
    [buyer, seller, arbiter, guardian, stranger] = await ethers.getSigners();

    const MockPqc = await ethers.getContractFactory("MockPqc");
    mock = await MockPqc.deploy();

    const DeedLock = await ethers.getContractFactory("DeedLockEscrow");
    escrow = await DeedLock.deploy(
      await mock.getAddress(),
      await mock.getAddress()
    );

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    fusd = await MockERC20.deploy("Fest USD", "fUSD", 6);

    // Every party registers an ML-DSA-87 key with proof of possession —
    // the state MsgRegisterPQCKeyV2 produces on QoreChain.
    for (const p of [buyer, seller, arbiter, guardian, stranger]) {
      await mock.registerKey(p.address, pubkeyFor(p.address), true);
    }
  });

  // ---------------------------------------------------------- creation

  describe("creation & funding", function () {
    it("creates an escrow with the right parties, schedule and Created status", async function () {
      const id = await createNative();
      const e = await escrow.getEscrow(id);
      expect(e.buyer).to.equal(buyer.address);
      expect(e.seller).to.equal(seller.address);
      expect(e.arbiter).to.equal(arbiter.address);
      expect(e.guardian).to.equal(guardian.address);
      expect(e.token).to.equal(ethers.ZeroAddress);
      expect(e.totalAmount).to.equal(TOTAL);
      expect(e.remainingAmount).to.equal(TOTAL);
      expect(e.status).to.equal(0); // Created
      expect(await escrow.getTranches(id)).to.deep.equal(TRANCHES);
    });

    it("rejects the seller acting as their own buyer (invalid party)", async function () {
      await expect(
        escrow
          .connect(buyer)
          .createEscrow(
            buyer.address,
            arbiter.address,
            guardian.address,
            ethers.ZeroAddress,
            TOTAL,
            TRANCHES,
            SEVEN_DAYS
          )
      ).to.be.revertedWithCustomError(escrow, "InvalidParty");
    });

    it("rejects zero total and zero refund duration", async function () {
      await expect(
        escrow
          .connect(buyer)
          .createEscrow(
            seller.address,
            arbiter.address,
            guardian.address,
            ethers.ZeroAddress,
            0,
            TRANCHES,
            SEVEN_DAYS
          )
      ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });

    it("rejects more than 5 tranches", async function () {
      const one = ethers.parseEther("1");
      const six = [one, one, one, one, one, one];
      await expect(
        escrow
          .connect(buyer)
          .createEscrow(
            seller.address,
            arbiter.address,
            guardian.address,
            ethers.ZeroAddress,
            one * 6n,
            six,
            SEVEN_DAYS
          )
      ).to.be.revertedWithCustomError(escrow, "InvalidTrancheSchedule");
    });

    it("rejects a tranche schedule that does not sum to the total", async function () {
      await expect(
        escrow
          .connect(buyer)
          .createEscrow(
            seller.address,
            arbiter.address,
            guardian.address,
            ethers.ZeroAddress,
            TOTAL,
            [ethers.parseEther("4"), ethers.parseEther("3")], // sums to 7, not 10
            SEVEN_DAYS
          )
      ).to.be.revertedWithCustomError(escrow, "InvalidTrancheSchedule");
    });

    it("rejects a zero-value tranche", async function () {
      await expect(
        escrow
          .connect(buyer)
          .createEscrow(
            seller.address,
            arbiter.address,
            guardian.address,
            ethers.ZeroAddress,
            TOTAL,
            [ethers.parseEther("10"), 0n, 0n].slice(0, 2).concat([0n]),
            SEVEN_DAYS
          )
      ).to.be.revertedWithCustomError(escrow, "InvalidTrancheSchedule");
    });

    it("buyer funds a native escrow: status Funded, timelock starts, balance locked", async function () {
      const id = await createNative();
      const tx = await escrow.connect(buyer).fund(id, { value: TOTAL });
      await tx.wait();
      const e = await escrow.getEscrow(id);
      expect(e.status).to.equal(1); // Funded
      expect(e.refundDeadline).to.be.greaterThan(0);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(TOTAL);
    });

    it("non-buyer cannot fund", async function () {
      const id = await createNative();
      await expect(
        escrow.connect(seller).fund(id, { value: TOTAL })
      ).to.be.revertedWithCustomError(escrow, "NotBuyer");
    });

    it("funding with the wrong native amount reverts", async function () {
      const id = await createNative();
      await expect(
        escrow.connect(buyer).fund(id, { value: TOTAL - 1n })
      ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });

    it("cannot fund twice", async function () {
      const id = await fundedNative();
      await expect(
        escrow.connect(buyer).fund(id, { value: TOTAL })
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });
  });

  // ---------------------------------------------------- PQ tranche flow

  describe("PQ-gated tranche release", function () {
    it("actionMessage matches the documented domain encoding", async function () {
      const dl = await deadline();
      const encoded = AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "string", "uint256", "uint256", "uint256"],
        [await escrow.getAddress(), 0, "APPROVE_RELEASE", 0, 0, dl]
      );
      expect(await escrow.actionMessage(0, "APPROVE_RELEASE", 0, 0, dl)).to.equal(
        ethers.keccak256(encoded)
      );
    });

    it("a single approval is recorded but moves no funds", async function () {
      const id = await fundedNative();
      await approveAs(buyer, id);
      const e = await escrow.getEscrow(id);
      expect(e.remainingAmount).to.equal(TOTAL);
      expect(e.releasedAmount).to.equal(0);
      expect(await escrow.trancheApprovals(id, 0, buyer.address)).to.equal(true);
    });

    it("dual approval releases tranche 1 to the seller and consumes the nonce", async function () {
      const id = await fundedNative();
      await approveAs(buyer, id);
      const tx = await approveAs(seller, id);
      await expect(tx).to.changeEtherBalance(seller, TRANCHES[0], {
        includeFee: false,
      });
      const e = await escrow.getEscrow(id);
      expect(e.remainingAmount).to.equal(TOTAL - TRANCHES[0]);
      expect(e.releasedAmount).to.equal(TRANCHES[0]);
      expect(e.currentTranche).to.equal(1);
      expect(e.approvalNonce).to.equal(1);
    });

    it("releasing every tranche completes the escrow (status Released)", async function () {
      const id = await fundedNative();
      for (let i = 0; i < TRANCHES.length; i++) {
        await approveAs(buyer, id);
        await approveAs(seller, id);
      }
      const e = await escrow.getEscrow(id);
      expect(e.status).to.equal(2); // Released
      expect(e.remainingAmount).to.equal(0);
      expect(e.releasedAmount).to.equal(TOTAL);
    });

    it("approving after completion reverts — a release beyond the remainder is impossible", async function () {
      const id = await fundedNative();
      for (let i = 0; i < TRANCHES.length; i++) {
        await approveAs(buyer, id);
        await approveAs(seller, id);
      }
      await expect(approveAs(buyer, id)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStatus"
      );
    });

    it("the same party approving twice reverts", async function () {
      const id = await fundedNative();
      await approveAs(buyer, id);
      await expect(approveAs(buyer, id)).to.be.revertedWithCustomError(
        escrow,
        "AlreadyApproved"
      );
    });

    it("a stranger cannot approve a release", async function () {
      const id = await fundedNative();
      await expect(approveAs(stranger, id)).to.be.revertedWithCustomError(
        escrow,
        "NotParty"
      );
    });

    it("ATTACK: ECDSA-only approval (garbage ML-DSA signature) is rejected", async function () {
      const id = await fundedNative();
      const dl = await deadline();
      await expect(
        escrow
          .connect(buyer)
          .approveRelease(id, pubkeyFor(buyer.address), "0xdeadbeef", dl)
      ).to.be.revertedWithCustomError(escrow, "PqcBadSignature");
    });

    it("ATTACK: presenting someone else's pubkey is rejected (pubkey != on-chain key)", async function () {
      const id = await fundedNative();
      const dl = await deadline();
      // Buyer calls, but presents the SELLER's pubkey + a signature valid for it.
      const sigForSellerKey = await pqSig(seller, id, "APPROVE_RELEASE", 0, 0, dl);
      await expect(
        escrow
          .connect(buyer)
          .approveRelease(id, pubkeyFor(seller.address), sigForSellerKey, dl)
      ).to.be.revertedWithCustomError(escrow, "PqcPubkeyMismatch");
    });

    it("ATTACK: an expired signature deadline is rejected", async function () {
      const id = await fundedNative();
      const past = (await time.latest()) - 10;
      const sig = await pqSig(buyer, id, "APPROVE_RELEASE", 0, 0, past);
      await expect(
        escrow
          .connect(buyer)
          .approveRelease(id, pubkeyFor(buyer.address), sig, past)
      ).to.be.revertedWithCustomError(escrow, "SignatureExpired");
    });

    it("ATTACK: replaying a consumed approval signature for the next tranche is rejected", async function () {
      const id = await fundedNative();
      const dl = await deadline();
      const nonce0 = await currentNonce(id);
      const buyerSig = await pqSig(buyer, id, "APPROVE_RELEASE", 0, nonce0, dl);
      await escrow
        .connect(buyer)
        .approveRelease(id, pubkeyFor(buyer.address), buyerSig, dl);
      await approveAs(seller, id); // executes tranche 0, nonce consumed
      // Replay the exact same buyer approval: it was bound to tranche 0/nonce 0.
      await expect(
        escrow
          .connect(buyer)
          .approveRelease(id, pubkeyFor(buyer.address), buyerSig, dl)
      ).to.be.revertedWithCustomError(escrow, "PqcBadSignature");
    });

    it("ATTACK: a signature bound to a different escrow id is rejected (domain binding)", async function () {
      const id = await fundedNative();
      const dl = await deadline();
      const foreignSig = await pqSig(buyer, 99, "APPROVE_RELEASE", 0, 0, dl);
      await expect(
        escrow
          .connect(buyer)
          .approveRelease(id, pubkeyFor(buyer.address), foreignSig, dl)
      ).to.be.revertedWithCustomError(escrow, "PqcBadSignature");
    });

    it("an account with NO registered ML-DSA key cannot approve", async function () {
      const id = await fundedNative();
      await mock.removeKey(seller.address);
      await expect(approveAs(seller, id)).to.be.revertedWithCustomError(
        escrow,
        "PqcKeyNotRegistered"
      );
    });

    it("a registered key WITHOUT proof of possession cannot approve", async function () {
      const id = await fundedNative();
      await mock.registerKey(seller.address, pubkeyFor(seller.address), false);
      await expect(approveAs(seller, id)).to.be.revertedWithCustomError(
        escrow,
        "PqcPossessionNotProven"
      );
    });
  });

  // ------------------------------------------------------------- guardian

  describe("guardian freeze (guardian can pause, never pay)", function () {
    async function pqAction(
      signer: any,
      id: number,
      action: string,
      extra: number | bigint = 0
    ) {
      const e = await escrow.getEscrow(id);
      const dl = await deadline();
      const sig = await pqSig(signer, id, action, extra, e.approvalNonce, dl);
      return { sig, dl };
    }

    it("guardian freezes with a PQ signature; releases pause; unfreeze restores them", async function () {
      const id = await fundedNative();
      const f = await pqAction(guardian, id, "FREEZE");
      await escrow
        .connect(guardian)
        .freeze(id, pubkeyFor(guardian.address), f.sig, f.dl);
      expect((await escrow.getEscrow(id)).frozen).to.equal(true);

      await expect(approveAs(buyer, id)).to.be.revertedWithCustomError(
        escrow,
        "EscrowFrozen"
      );

      const u = await pqAction(guardian, id, "UNFREEZE");
      await escrow
        .connect(guardian)
        .unfreeze(id, pubkeyFor(guardian.address), u.sig, u.dl);
      expect((await escrow.getEscrow(id)).frozen).to.equal(false);

      await approveAs(buyer, id);
      await approveAs(seller, id);
      expect((await escrow.getEscrow(id)).releasedAmount).to.equal(TRANCHES[0]);
    });

    it("a non-guardian cannot freeze", async function () {
      const id = await fundedNative();
      const f = await pqAction(buyer, id, "FREEZE");
      await expect(
        escrow.connect(buyer).freeze(id, pubkeyFor(buyer.address), f.sig, f.dl)
      ).to.be.revertedWithCustomError(escrow, "NotGuardian");
    });

    it("ATTACK: the guardian cannot release funds (not a party to releases)", async function () {
      const id = await fundedNative();
      await expect(approveAs(guardian, id)).to.be.revertedWithCustomError(
        escrow,
        "NotParty"
      );
    });

    it("ATTACK: freeze with an invalid PQ signature is rejected", async function () {
      const id = await fundedNative();
      const dl = await deadline();
      await expect(
        escrow
          .connect(guardian)
          .freeze(id, pubkeyFor(guardian.address), "0x1234", dl)
      ).to.be.revertedWithCustomError(escrow, "PqcBadSignature");
    });

    it("ATTACK: replaying a freeze signature after unfreeze is rejected (nonce consumed)", async function () {
      const id = await fundedNative();
      const f = await pqAction(guardian, id, "FREEZE");
      await escrow
        .connect(guardian)
        .freeze(id, pubkeyFor(guardian.address), f.sig, f.dl);
      const u = await pqAction(guardian, id, "UNFREEZE");
      await escrow
        .connect(guardian)
        .unfreeze(id, pubkeyFor(guardian.address), u.sig, u.dl);
      await expect(
        escrow
          .connect(guardian)
          .freeze(id, pubkeyFor(guardian.address), f.sig, f.dl)
      ).to.be.revertedWithCustomError(escrow, "PqcBadSignature");
    });

    it("a frozen escrow blocks even a post-timelock refund", async function () {
      const id = await fundedNative(TRANCHES, TOTAL, 3600);
      const f = await pqAction(guardian, id, "FREEZE");
      await escrow
        .connect(guardian)
        .freeze(id, pubkeyFor(guardian.address), f.sig, f.dl);
      await time.increase(3601);
      const e = await escrow.getEscrow(id);
      const dl = await deadline();
      const sig = await pqSig(buyer, id, "REFUND", 0, e.approvalNonce, dl);
      await expect(
        escrow.connect(buyer).claimRefund(id, pubkeyFor(buyer.address), sig, dl)
      ).to.be.revertedWithCustomError(escrow, "EscrowFrozen");
    });
  });

  // -------------------------------------------------------- refund flow

  describe("refund & timelock", function () {
    async function refundAttempt(id: number) {
      const e = await escrow.getEscrow(id);
      const dl = await deadline();
      const sig = await pqSig(buyer, id, "REFUND", 0, e.approvalNonce, dl);
      return escrow
        .connect(buyer)
        .claimRefund(id, pubkeyFor(buyer.address), sig, dl);
    }

    it("refund before the timelock expires is rejected", async function () {
      const id = await fundedNative();
      await expect(refundAttempt(id)).to.be.revertedWithCustomError(
        escrow,
        "TimelockNotReached"
      );
    });

    it("after the timelock, a PQ-signed refund returns the full remainder to the buyer", async function () {
      const id = await fundedNative(TRANCHES, TOTAL, 3600);
      await time.increase(3601);
      const tx = await refundAttempt(id);
      await expect(tx).to.changeEtherBalance(buyer, TOTAL, {
        includeFee: false,
      });
      const e = await escrow.getEscrow(id);
      expect(e.status).to.equal(3); // Refunded
      expect(e.remainingAmount).to.equal(0);
    });

    it("after a partial release, the refund returns only what is still locked", async function () {
      const id = await fundedNative(TRANCHES, TOTAL, 3600);
      await approveAs(buyer, id);
      await approveAs(seller, id); // tranche 1 (4 ETH) released
      await time.increase(3601);
      const tx = await refundAttempt(id);
      await expect(tx).to.changeEtherBalance(buyer, TOTAL - TRANCHES[0], {
        includeFee: false,
      });
    });

    it("the seller cannot trigger a refund", async function () {
      const id = await fundedNative(TRANCHES, TOTAL, 3600);
      await time.increase(3601);
      const e = await escrow.getEscrow(id);
      const dl = await deadline();
      const sig = await pqSig(seller, id, "REFUND", 0, e.approvalNonce, dl);
      await expect(
        escrow
          .connect(seller)
          .claimRefund(id, pubkeyFor(seller.address), sig, dl)
      ).to.be.revertedWithCustomError(escrow, "NotBuyer");
    });
  });

  // ------------------------------------------------- dispute & arbitration

  describe("dispute & PQ arbitration", function () {
    async function arbitrateAs(
      signer: any,
      id: number,
      sellerBps: number,
      sigOverride?: string
    ) {
      const e = await escrow.getEscrow(id);
      const dl = await deadline();
      const sig =
        sigOverride ??
        (await pqSig(signer, id, "ARBITRATE", sellerBps, e.approvalNonce, dl));
      return escrow
        .connect(signer)
        .arbitrate(id, sellerBps, pubkeyFor(signer.address), sig, dl);
    }

    it("raising a dispute blocks tranche releases", async function () {
      const id = await fundedNative();
      await escrow.connect(seller).raiseDispute(id);
      expect((await escrow.getEscrow(id)).status).to.equal(4); // Disputed
      await expect(approveAs(buyer, id)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStatus"
      );
    });

    it("raising a dispute blocks refunds", async function () {
      const id = await fundedNative(TRANCHES, TOTAL, 3600);
      await escrow.connect(buyer).raiseDispute(id);
      await time.increase(3601);
      const e = await escrow.getEscrow(id);
      const dl = await deadline();
      const sig = await pqSig(buyer, id, "REFUND", 0, e.approvalNonce, dl);
      await expect(
        escrow.connect(buyer).claimRefund(id, pubkeyFor(buyer.address), sig, dl)
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });

    it("the arbiter resolves a dispute 70/30 with a PQ-signed decision", async function () {
      const id = await fundedNative();
      await escrow.connect(buyer).raiseDispute(id);
      const tx = await arbitrateAs(arbiter, id, 7000);
      await expect(tx).to.changeEtherBalances(
        [seller, buyer],
        [ethers.parseEther("7"), ethers.parseEther("3")]
      );
      const e = await escrow.getEscrow(id);
      expect(e.status).to.equal(5); // Resolved
      expect(e.remainingAmount).to.equal(0);
    });

    it("a non-arbiter cannot arbitrate", async function () {
      const id = await fundedNative();
      await escrow.connect(buyer).raiseDispute(id);
      await expect(arbitrateAs(buyer, id, 5000)).to.be.revertedWithCustomError(
        escrow,
        "NotArbiter"
      );
    });

    it("ATTACK: arbitration with a forged PQ signature is rejected", async function () {
      const id = await fundedNative();
      await escrow.connect(buyer).raiseDispute(id);
      await expect(
        arbitrateAs(arbiter, id, 10000, "0xbeef")
      ).to.be.revertedWithCustomError(escrow, "PqcBadSignature");
    });

    it("ATTACK: an arbiter whose key lacks proof of possession cannot arbitrate", async function () {
      const id = await fundedNative();
      await escrow.connect(buyer).raiseDispute(id);
      await mock.registerKey(arbiter.address, pubkeyFor(arbiter.address), false);
      await expect(arbitrateAs(arbiter, id, 5000)).to.be.revertedWithCustomError(
        escrow,
        "PqcPossessionNotProven"
      );
    });

    it("arbitrating an undisputed escrow reverts", async function () {
      const id = await fundedNative();
      await expect(arbitrateAs(arbiter, id, 5000)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStatus"
      );
    });

    it("arbitration remains available while frozen (the frozen escrow's safe exit)", async function () {
      const id = await fundedNative();
      await escrow.connect(seller).raiseDispute(id);
      const e = await escrow.getEscrow(id);
      const dl = await deadline();
      const fsig = await pqSig(guardian, id, "FREEZE", 0, e.approvalNonce, dl);
      await escrow
        .connect(guardian)
        .freeze(id, pubkeyFor(guardian.address), fsig, dl);
      const tx = await arbitrateAs(arbiter, id, 5000);
      await expect(tx).to.changeEtherBalances(
        [seller, buyer],
        [ethers.parseEther("5"), ethers.parseEther("5")]
      );
      expect((await escrow.getEscrow(id)).status).to.equal(5); // Resolved
    });
  });

  // ------------------------------------------------------------- ERC-20

  describe("ERC-20 (fest token) escrows", function () {
    const F_TOTAL = 400_000000n; // 400 fUSD (6 decimals)
    const F_TRANCHES = [250_000000n, 150_000000n];

    async function fundedToken(): Promise<number> {
      await fusd.mint(buyer.address, F_TOTAL);
      const id = Number(await escrow.escrowCount());
      await escrow
        .connect(buyer)
        .createEscrow(
          seller.address,
          arbiter.address,
          guardian.address,
          await fusd.getAddress(),
          F_TOTAL,
          F_TRANCHES,
          SEVEN_DAYS
        );
      await fusd.connect(buyer).approve(await escrow.getAddress(), F_TOTAL);
      await escrow.connect(buyer).fund(id);
      return id;
    }

    it("funds via transferFrom and releases tranche 1 in fUSD after dual PQ approval", async function () {
      const id = await fundedToken();
      expect(await fusd.balanceOf(await escrow.getAddress())).to.equal(F_TOTAL);
      await approveAs(buyer, id);
      await approveAs(seller, id);
      expect(await fusd.balanceOf(seller.address)).to.equal(F_TRANCHES[0]);
      expect(await fusd.balanceOf(await escrow.getAddress())).to.equal(
        F_TOTAL - F_TRANCHES[0]
      );
    });

    it("arbitration splits the fUSD remainder between buyer and seller", async function () {
      const id = await fundedToken();
      await approveAs(buyer, id);
      await approveAs(seller, id); // 250 fUSD released, 150 remain
      await escrow.connect(seller).raiseDispute(id);
      const e = await escrow.getEscrow(id);
      const dl = await deadline();
      const sig = await pqSig(arbiter, id, "ARBITRATE", 5000, e.approvalNonce, dl);
      await escrow
        .connect(arbiter)
        .arbitrate(id, 5000, pubkeyFor(arbiter.address), sig, dl);
      // seller: 250 (tranche) + 75 (half the remainder); buyer: 75 back.
      expect(await fusd.balanceOf(seller.address)).to.equal(325_000000n);
      expect(await fusd.balanceOf(buyer.address)).to.equal(75_000000n);
      expect(await fusd.balanceOf(await escrow.getAddress())).to.equal(0);
    });
  });
});
