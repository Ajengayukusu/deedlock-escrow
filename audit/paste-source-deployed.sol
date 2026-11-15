// ============================================================
// DeedLock Escrow — combined source for QCAI audit (dashboard.qorechain.io/audit)
// Repo commit: f0e5fb98735adbf06ad19dca9639388ccd9f6f9e (deployed source)
// Deployed on Diana testnet: 0xb6d7B326F44729772dbAD5B094B61E40C1a71b07
// File 1 of 2: contracts/IQorePqc.sol
// ============================================================
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IQorePqc — interfaces for the QoreChain post-quantum precompiles.
/// @notice On QoreChain Diana testnet (chain v3.2.4+) these are two SEPARATE
///         precompiles:
///           - pqcVerify    at 0x0000000000000000000000000000000000000A01
///           - pqcKeyStatus at 0x0000000000000000000000000000000000000A02
///         The escrow contract therefore receives both addresses via its
///         constructor (dependency injection), which also makes the contract
///         testable locally against MockPqc.
///
/// @dev ARGUMENT ORDER MATTERS. The Solidity precompile ABI is
///      pqcVerify(pubkey, signature, message) — this is NOT the same order as
///      the JavaScript SDK helper pqcVerify(publicKey, message, signature).
interface IQorePqcVerify {
    /// @param pubkey    ML-DSA-87 public key (2592 bytes on the real chain).
    /// @param signature ML-DSA-87 signature (4627 bytes on the real chain).
    /// @param message   The exact message bytes that were signed.
    /// @return valid    True iff the signature verifies for pubkey + message.
    function pqcVerify(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes calldata message
    ) external view returns (bool valid);
}

interface IQorePqcKeyStatus {
    /// @notice Returns FOUR values since chain v3.2.4. Older 3-value decoders
    ///         break against the live precompile — do not "simplify" this.
    /// @return registered       The account has an ML-DSA key registered on chain.
    /// @return algorithmId      Signature algorithm id (1 = ML-DSA-87 / FIPS 204).
    /// @return pubkey           The public key actually registered on chain.
    /// @return possessionProven The account proved possession of the private key
    ///                          at registration time (MsgRegisterPQCKeyV2).
    function pqcKeyStatus(
        address account
    )
        external
        view
        returns (
            bool registered,
            uint8 algorithmId,
            bytes memory pubkey,
            bool possessionProven
        );
}

// ============================================================
// File 2 of 2: contracts/DeedLockEscrow.sol
// ============================================================
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IQorePqc.sol";

/// @title DeedLockEscrow — post-quantum down-payment (DP) escrow.
/// @notice Built for the QoreChain "Build Before Q-Day" Developer Fest,
///         Post-Quantum dApp category.
///
///         Problem (Indonesia): down payments for houses and used vehicles are
///         routinely lost to fraud — a seller disappears after the DP, or a
///         buyer is pressured to release money before the deed (AJB / BPKB)
///         is actually transferred. A normal multisig does not fix this on a
///         decades-long horizon: an escrow agreement can be disputed years
///         later, long after a quantum attacker could forge a classical
///         ECDSA approval from a leaked public key ("harvest now, forge
///         later"). DeedLock therefore requires every fund-moving approval to
///         carry a fresh ML-DSA-87 (FIPS 204) signature, verified ON CHAIN by
///         the QoreChain pqcVerify precompile, bound to the signer's
///         registered on-chain ML-DSA key.
///
///         Core invariant: `msg.sender` alone NEVER releases money. Every
///         sensitive action (approve a tranche release, arbitrate a dispute,
///         freeze/unfreeze, refund after the timelock) must additionally
///         present:
///           1. the caller's ML-DSA-87 public key — which must hash-match the
///              key actually registered on chain for msg.sender
///              (pqcKeyStatus), with registration + proof-of-possession, and
///           2. a valid ML-DSA-87 signature (pqcVerify) over a domain-bound
///              message: keccak256(abi.encode(escrowContract, escrowId,
///              action, extra, nonce, deadline)) — the per-escrow nonce is
///              consumed by every executed action (anti-replay) and the
///              deadline bounds the signature in time.
///
///         State machine per escrow:
///           Created --fund--> Funded --all tranches released--> Released
///                      Funded --refund after timelock (buyer, PQ)--> Refunded
///                      Funded --raiseDispute--> Disputed
///                      Disputed --arbitrate (arbiter, PQ)--> Resolved
///         A guardian may freeze/unfreeze a Funded or Disputed escrow
///         (PQ-signed). Freezing pauses releases and refunds; it can NEVER
///         move funds, and arbitration stays available while frozen so a
///         frozen escrow always has a safe exit.
contract DeedLockEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ types

    enum Status {
        Created,
        Funded,
        Released,
        Refunded,
        Disputed,
        Resolved
    }

    struct Escrow {
        address buyer;
        address seller;
        address arbiter;
        address guardian;
        address token; // address(0) = native QOR
        uint256 totalAmount;
        uint256 remainingAmount;
        uint256 releasedAmount;
        uint256[] tranches; // milestone schedule, max MAX_TRANCHES, sums to totalAmount
        uint256 currentTranche; // index of the next tranche awaiting release
        uint256 refundDuration; // seconds the seller is protected after funding
        uint256 refundDeadline; // set at funding time; 0 until funded
        uint256 approvalNonce; // anti-replay nonce, consumed by executed actions
        Status status;
        bool frozen;
    }

    uint256 public constant MAX_TRANCHES = 5;
    uint8 public constant MLDSA87_ALGORITHM_ID = 1;

    // ------------------------------------------------------------- immutables

    IQorePqcVerify public immutable pqcVerifyPrecompile;
    IQorePqcKeyStatus public immutable pqcKeyStatusPrecompile;

    // ---------------------------------------------------------------- storage

    Escrow[] private _escrows;
    /// escrowId => trancheIndex => party => approved
    mapping(uint256 => mapping(uint256 => mapping(address => bool)))
        public trancheApprovals;

    // ----------------------------------------------------------------- events

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        address arbiter,
        address guardian,
        address token,
        uint256 totalAmount,
        uint256 trancheCount
    );
    event EscrowFunded(
        uint256 indexed escrowId,
        uint256 totalAmount,
        uint256 refundDeadline
    );
    event TrancheApproved(
        uint256 indexed escrowId,
        uint256 indexed trancheIndex,
        address indexed approver
    );
    event TrancheReleased(
        uint256 indexed escrowId,
        uint256 indexed trancheIndex,
        address indexed seller,
        uint256 amount
    );
    event DisputeRaised(uint256 indexed escrowId, address indexed raisedBy);
    event Arbitrated(
        uint256 indexed escrowId,
        address indexed arbiter,
        uint256 sellerAmount,
        uint256 buyerAmount
    );
    event Refunded(uint256 indexed escrowId, address indexed buyer, uint256 amount);
    event Frozen(uint256 indexed escrowId, address indexed guardian);
    event Unfrozen(uint256 indexed escrowId, address indexed guardian);

    // ----------------------------------------------------------------- errors

    error InvalidParty();
    error InvalidAmount();
    error InvalidTrancheSchedule();
    error InvalidStatus();
    error NotBuyer();
    error NotParty();
    error NotArbiter();
    error NotGuardian();
    error AlreadyApproved();
    error EscrowFrozen();
    error NotFrozen();
    error AlreadyFrozen();
    error TimelockNotReached();
    error SignatureExpired();
    error PqcKeyNotRegistered();
    error PqcPossessionNotProven();
    error PqcWrongAlgorithm();
    error PqcPubkeyMismatch();
    error PqcBadSignature();
    error InvalidBps();
    error NothingToSettle();

    // ------------------------------------------------------------ constructor

    /// @param pqcVerifyAddress    pqcVerify precompile (Diana: 0x0A01).
    /// @param pqcKeyStatusAddress pqcKeyStatus precompile (Diana: 0x0A02).
    ///        Injected (instead of hard-coded) so tests can substitute MockPqc.
    constructor(address pqcVerifyAddress, address pqcKeyStatusAddress) {
        pqcVerifyPrecompile = IQorePqcVerify(pqcVerifyAddress);
        pqcKeyStatusPrecompile = IQorePqcKeyStatus(pqcKeyStatusAddress);
    }

    // ------------------------------------------------------------- PQC gate

    /// @notice The domain-bound message every sensitive action must sign:
    ///         keccak256(abi.encode(escrowContract, escrowId, action, extra,
    ///         nonce, deadline)). Public so wallets / the QoreChain SDK can
    ///         reproduce it byte-for-byte off chain before signing.
    /// @param action e.g. "APPROVE_RELEASE", "ARBITRATE", "FREEZE",
    ///        "UNFREEZE", "REFUND".
    /// @param extra  Action parameter bound into the signature: tranche index
    ///        for APPROVE_RELEASE, seller basis points for ARBITRATE, 0 else.
    function actionMessage(
        uint256 escrowId,
        string memory action,
        uint256 extra,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    address(this),
                    escrowId,
                    action,
                    extra,
                    nonce,
                    deadline
                )
            );
    }

    /// @dev Full PQ authorisation for `account` (= msg.sender at call sites):
    ///      deadline live, key registered AND possession-proven AND ML-DSA-87,
    ///      presented pubkey == registered pubkey, signature valid.
    function _verifyPqc(
        address account,
        uint256 escrowId,
        string memory action,
        uint256 extra,
        uint256 nonce,
        uint256 deadline,
        bytes calldata pubkey,
        bytes calldata signature
    ) internal view {
        if (block.timestamp > deadline) revert SignatureExpired();

        (
            bool registered,
            uint8 algorithmId,
            bytes memory onchainPubkey,
            bool possessionProven
        ) = pqcKeyStatusPrecompile.pqcKeyStatus(account);

        if (!registered) revert PqcKeyNotRegistered();
        if (!possessionProven) revert PqcPossessionNotProven();
        if (algorithmId != MLDSA87_ALGORITHM_ID) revert PqcWrongAlgorithm();
        if (keccak256(pubkey) != keccak256(onchainPubkey))
            revert PqcPubkeyMismatch();

        bytes32 messageHash = actionMessage(
            escrowId,
            action,
            extra,
            nonce,
            deadline
        );
        // pqcVerify argument order: (pubkey, signature, message).
        bool ok = pqcVerifyPrecompile.pqcVerify(
            pubkey,
            signature,
            abi.encodePacked(messageHash)
        );
        if (!ok) revert PqcBadSignature();
    }

    // ------------------------------------------------------------ lifecycle

    /// @notice Create an escrow. The caller becomes the buyer.
    /// @param tranches Milestone schedule (1..5 entries); must sum to
    ///        totalAmount exactly — an over- or under-committed schedule is
    ///        rejected here, so a release can never exceed the funded total.
    function createEscrow(
        address seller,
        address arbiter,
        address guardian,
        address token,
        uint256 totalAmount,
        uint256[] calldata tranches,
        uint256 refundDuration
    ) external returns (uint256 escrowId) {
        if (
            seller == address(0) ||
            arbiter == address(0) ||
            guardian == address(0) ||
            seller == msg.sender ||
            arbiter == msg.sender ||
            guardian == msg.sender ||
            seller == arbiter ||
            seller == guardian ||
            arbiter == guardian
        ) revert InvalidParty();
        if (totalAmount == 0 || refundDuration == 0) revert InvalidAmount();
        if (tranches.length == 0 || tranches.length > MAX_TRANCHES)
            revert InvalidTrancheSchedule();
        uint256 sum;
        for (uint256 i = 0; i < tranches.length; i++) {
            if (tranches[i] == 0) revert InvalidTrancheSchedule();
            sum += tranches[i];
        }
        if (sum != totalAmount) revert InvalidTrancheSchedule();

        escrowId = _escrows.length;
        Escrow storage e = _escrows.push();
        e.buyer = msg.sender;
        e.seller = seller;
        e.arbiter = arbiter;
        e.guardian = guardian;
        e.token = token;
        e.totalAmount = totalAmount;
        e.remainingAmount = totalAmount;
        e.tranches = tranches;
        e.refundDuration = refundDuration;
        e.status = Status.Created;

        emit EscrowCreated(
            escrowId,
            msg.sender,
            seller,
            arbiter,
            guardian,
            token,
            totalAmount,
            tranches.length
        );
    }

    /// @notice Fund a Created escrow. Buyer only. Native: send exactly
    ///         totalAmount as msg.value. ERC-20: approve totalAmount first.
    ///         Funding starts the refund timelock that protects the seller.
    function fund(uint256 escrowId) external payable nonReentrant {
        Escrow storage e = _get(escrowId);
        if (msg.sender != e.buyer) revert NotBuyer();
        if (e.status != Status.Created) revert InvalidStatus();

        if (e.token == address(0)) {
            if (msg.value != e.totalAmount) revert InvalidAmount();
        } else {
            if (msg.value != 0) revert InvalidAmount();
            IERC20(e.token).safeTransferFrom(
                msg.sender,
                address(this),
                e.totalAmount
            );
        }

        e.status = Status.Funded;
        e.refundDeadline = block.timestamp + e.refundDuration;
        emit EscrowFunded(escrowId, e.totalAmount, e.refundDeadline);
    }

    // --------------------------------------------------------- tranche flow

    /// @notice Approve release of the CURRENT tranche. Both buyer and seller
    ///         must approve (each with their own PQ signature over
    ///         (escrow, id, "APPROVE_RELEASE", trancheIndex, nonce, deadline));
    ///         the second approval executes the payment to the seller and
    ///         consumes the nonce, so neither signature can ever be replayed
    ///         for a later tranche.
    function approveRelease(
        uint256 escrowId,
        bytes calldata pubkey,
        bytes calldata signature,
        uint256 deadline
    ) external nonReentrant {
        Escrow storage e = _get(escrowId);
        if (e.status != Status.Funded) revert InvalidStatus();
        if (e.frozen) revert EscrowFrozen();
        if (msg.sender != e.buyer && msg.sender != e.seller)
            revert NotParty();

        uint256 trancheIndex = e.currentTranche;
        if (trancheApprovals[escrowId][trancheIndex][msg.sender])
            revert AlreadyApproved();

        _verifyPqc(
            msg.sender,
            escrowId,
            "APPROVE_RELEASE",
            trancheIndex,
            e.approvalNonce,
            deadline,
            pubkey,
            signature
        );

        trancheApprovals[escrowId][trancheIndex][msg.sender] = true;
        emit TrancheApproved(escrowId, trancheIndex, msg.sender);

        if (
            trancheApprovals[escrowId][trancheIndex][e.buyer] &&
            trancheApprovals[escrowId][trancheIndex][e.seller]
        ) {
            uint256 amount = e.tranches[trancheIndex];
            if (amount > e.remainingAmount) revert InvalidAmount();
            e.remainingAmount -= amount;
            e.releasedAmount += amount;
            e.currentTranche += 1;
            e.approvalNonce += 1; // consume both signatures
            if (e.currentTranche == e.tranches.length) {
                e.status = Status.Released;
            }
            _pay(e, e.seller, amount);
            emit TrancheReleased(escrowId, trancheIndex, e.seller, amount);
        }
    }

    // --------------------------------------------------------------- refund

    /// @notice After the refund timelock expires, the buyer may pull the
    ///         still-locked remainder back — but only with a PQ signature.
    ///         Before the deadline, or while disputed/frozen, this reverts.
    function claimRefund(
        uint256 escrowId,
        bytes calldata pubkey,
        bytes calldata signature,
        uint256 deadline
    ) external nonReentrant {
        Escrow storage e = _get(escrowId);
        if (msg.sender != e.buyer) revert NotBuyer();
        if (e.status != Status.Funded) revert InvalidStatus();
        if (e.frozen) revert EscrowFrozen();
        if (block.timestamp <= e.refundDeadline) revert TimelockNotReached();
        if (e.remainingAmount == 0) revert NothingToSettle();

        _verifyPqc(
            msg.sender,
            escrowId,
            "REFUND",
            0,
            e.approvalNonce,
            deadline,
            pubkey,
            signature
        );

        uint256 amount = e.remainingAmount;
        e.remainingAmount = 0;
        e.approvalNonce += 1;
        e.status = Status.Refunded;
        _pay(e, e.buyer, amount);
        emit Refunded(escrowId, e.buyer, amount);
    }

    // -------------------------------------------------------------- dispute

    /// @notice Buyer or seller flags a dispute. Moves no funds; it pauses
    ///         releases and refunds until the arbiter resolves it.
    function raiseDispute(uint256 escrowId) external {
        Escrow storage e = _get(escrowId);
        if (msg.sender != e.buyer && msg.sender != e.seller)
            revert NotParty();
        if (e.status != Status.Funded) revert InvalidStatus();
        e.status = Status.Disputed;
        emit DisputeRaised(escrowId, msg.sender);
    }

    /// @notice Resolve a dispute. Arbiter only, and the arbiter's decision is
    ///         itself PQ-signed: the signature binds sellerBps, so a decision
    ///         cannot be altered or replayed after the fact.
    /// @param sellerBps Share of the REMAINING amount paid to the seller,
    ///        in basis points (0..10000); the buyer receives the rest.
    function arbitrate(
        uint256 escrowId,
        uint256 sellerBps,
        bytes calldata pubkey,
        bytes calldata signature,
        uint256 deadline
    ) external nonReentrant {
        Escrow storage e = _get(escrowId);
        if (msg.sender != e.arbiter) revert NotArbiter();
        if (e.status != Status.Disputed) revert InvalidStatus();
        if (sellerBps > 10_000) revert InvalidBps();
        if (e.remainingAmount == 0) revert NothingToSettle();

        _verifyPqc(
            msg.sender,
            escrowId,
            "ARBITRATE",
            sellerBps,
            e.approvalNonce,
            deadline,
            pubkey,
            signature
        );

        uint256 remaining = e.remainingAmount;
        uint256 sellerAmount = (remaining * sellerBps) / 10_000;
        uint256 buyerAmount = remaining - sellerAmount;
        e.remainingAmount = 0;
        e.releasedAmount += sellerAmount;
        e.approvalNonce += 1;
        e.status = Status.Resolved;

        if (sellerAmount > 0) _pay(e, e.seller, sellerAmount);
        if (buyerAmount > 0) _pay(e, e.buyer, buyerAmount);
        emit Arbitrated(escrowId, msg.sender, sellerAmount, buyerAmount);
    }

    // ------------------------------------------------------------- guardian

    /// @notice Freeze a Funded/Disputed escrow. Guardian only, PQ-signed.
    ///         Freezing pauses releases and refunds; arbitration remains
    ///         possible. The guardian has NO function that moves funds.
    function freeze(
        uint256 escrowId,
        bytes calldata pubkey,
        bytes calldata signature,
        uint256 deadline
    ) external {
        Escrow storage e = _get(escrowId);
        if (msg.sender != e.guardian) revert NotGuardian();
        if (e.status != Status.Funded && e.status != Status.Disputed)
            revert InvalidStatus();
        if (e.frozen) revert AlreadyFrozen();

        _verifyPqc(
            msg.sender,
            escrowId,
            "FREEZE",
            0,
            e.approvalNonce,
            deadline,
            pubkey,
            signature
        );

        e.frozen = true;
        e.approvalNonce += 1; // a freeze signature can never be replayed
        emit Frozen(escrowId, msg.sender);
    }

    /// @notice Unfreeze. Guardian only, PQ-signed.
    function unfreeze(
        uint256 escrowId,
        bytes calldata pubkey,
        bytes calldata signature,
        uint256 deadline
    ) external {
        Escrow storage e = _get(escrowId);
        if (msg.sender != e.guardian) revert NotGuardian();
        if (!e.frozen) revert NotFrozen();

        _verifyPqc(
            msg.sender,
            escrowId,
            "UNFREEZE",
            0,
            e.approvalNonce,
            deadline,
            pubkey,
            signature
        );

        e.frozen = false;
        e.approvalNonce += 1;
        emit Unfrozen(escrowId, msg.sender);
    }

    // ---------------------------------------------------------------- views

    function escrowCount() external view returns (uint256) {
        return _escrows.length;
    }

    function getEscrow(
        uint256 escrowId
    )
        external
        view
        returns (
            address buyer,
            address seller,
            address arbiter,
            address guardian,
            address token,
            uint256 totalAmount,
            uint256 remainingAmount,
            uint256 releasedAmount,
            uint256 currentTranche,
            uint256 refundDeadline,
            uint256 approvalNonce,
            Status status,
            bool frozen
        )
    {
        Escrow storage e = _get(escrowId);
        return (
            e.buyer,
            e.seller,
            e.arbiter,
            e.guardian,
            e.token,
            e.totalAmount,
            e.remainingAmount,
            e.releasedAmount,
            e.currentTranche,
            e.refundDeadline,
            e.approvalNonce,
            e.status,
            e.frozen
        );
    }

    function getTranches(
        uint256 escrowId
    ) external view returns (uint256[] memory) {
        return _get(escrowId).tranches;
    }

    // ------------------------------------------------------------- internal

    function _get(uint256 escrowId) internal view returns (Escrow storage) {
        require(escrowId < _escrows.length, "no such escrow");
        return _escrows[escrowId];
    }

    function _pay(Escrow storage e, address to, uint256 amount) internal {
        if (e.token == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            require(ok, "native transfer failed");
        } else {
            IERC20(e.token).safeTransfer(to, amount);
        }
    }
}
