// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IQorePqc.sol";

/// @title MockPqc — local stand-in for the QoreChain PQC precompiles (tests only).
/// @notice Mimics the *behaviour contract* of 0x0A01 / 0x0A02:
///         - pqcKeyStatus answers from a registry the test controls: registered
///           flag, algorithmId 1 (ML-DSA-87), the registered pubkey bytes and
///           the possessionProven flag.
///         - pqcVerify returns true ONLY for the "signature" produced by
///           mockSign() for that exact pubkey + message. A signature made for a
///           different pubkey, a different message, or garbage bytes fails —
///           exactly the negative cases the escrow tests exercise.
/// @dev This is NOT cryptography. The mock signature is a keyed hash so tests
///      can model "valid ML-DSA signature" vs "anything else". On Diana the
///      real precompile performs genuine FIPS 204 ML-DSA-87 verification.
///      Never deploy this mock to a network with real value.
contract MockPqc is IQorePqcVerify, IQorePqcKeyStatus {
    struct KeyInfo {
        bool registered;
        bool possessionProven;
        bytes pubkey;
    }

    mapping(address => KeyInfo) private _keys;

    /// @notice Test helper: register (or overwrite) the on-chain key record
    ///         for an account, mirroring MsgRegisterPQCKeyV2 outcomes.
    function registerKey(
        address account,
        bytes calldata pubkey,
        bool possessionProven
    ) external {
        _keys[account] = KeyInfo({
            registered: true,
            possessionProven: possessionProven,
            pubkey: pubkey
        });
    }

    /// @notice Test helper: remove an account's key record entirely.
    function removeKey(address account) external {
        delete _keys[account];
    }

    function pqcKeyStatus(
        address account
    )
        external
        view
        override
        returns (
            bool registered,
            uint8 algorithmId,
            bytes memory pubkey,
            bool possessionProven
        )
    {
        KeyInfo storage k = _keys[account];
        return (
            k.registered,
            k.registered ? uint8(1) : uint8(0), // 1 = ML-DSA-87
            k.pubkey,
            k.possessionProven
        );
    }

    /// @notice The mock signing oracle. Tests obtain "valid ML-DSA signatures"
    ///         by calling this with the signer's registered pubkey and the
    ///         exact domain-bound message produced by the escrow contract.
    function mockSign(
        bytes memory pubkey,
        bytes memory message
    ) public pure returns (bytes memory) {
        return
            abi.encodePacked(
                keccak256(abi.encode(pubkey, message, "DEEDLOCK-MOCK-PQC-V1"))
            );
    }

    function pqcVerify(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes calldata message
    ) external pure override returns (bool valid) {
        bytes memory expected = mockSign(pubkey, message);
        return keccak256(signature) == keccak256(expected);
    }
}
