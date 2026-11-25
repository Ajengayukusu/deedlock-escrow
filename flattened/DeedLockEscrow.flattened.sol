// Sources flattened with hardhat v2.29.2 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/introspection/IERC165.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/IERC165.sol)

pragma solidity >=0.4.16;

/**
 * @dev Interface of the ERC-165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[ERC].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}


// File @openzeppelin/contracts/interfaces/IERC165.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC165.sol)

pragma solidity >=0.4.16;


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/IERC20.sol)

pragma solidity >=0.4.16;

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}


// File @openzeppelin/contracts/interfaces/IERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC20.sol)

pragma solidity >=0.4.16;


// File @openzeppelin/contracts/interfaces/IERC1363.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC1363.sol)

pragma solidity >=0.6.2;


/**
 * @title IERC1363
 * @dev Interface of the ERC-1363 standard as defined in the https://eips.ethereum.org/EIPS/eip-1363[ERC-1363].
 *
 * Defines an extension interface for ERC-20 tokens that supports executing code on a recipient contract
 * after `transfer` or `transferFrom`, or code on a spender contract after `approve`, in a single transaction.
 */
interface IERC1363 is IERC20, IERC165 {
    /*
     * Note: the ERC-165 identifier for this interface is 0xb0202a11.
     * 0xb0202a11 ===
     *   bytes4(keccak256('transferAndCall(address,uint256)')) ^
     *   bytes4(keccak256('transferAndCall(address,uint256,bytes)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256,bytes)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256,bytes)'))
     */

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @param data Additional data with no specified format, sent in call to `spender`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value, bytes calldata data) external returns (bool);
}


// File @openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (token/ERC20/utils/SafeERC20.sol)

pragma solidity ^0.8.20;


/**
 * @title SafeERC20
 * @dev Wrappers around ERC-20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    /**
     * @dev An operation with an ERC-20 token failed.
     */
    error SafeERC20FailedOperation(address token);

    /**
     * @dev Indicates a failed `decreaseAllowance` request.
     */
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    /**
     * @dev Transfer `value` amount of `token` from the calling contract to `to`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        if (!_safeTransfer(token, to, value, true)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Transfer `value` amount of `token` from `from` to `to`, spending the approval given by `from` to the
     * calling contract. If `token` returns no value, non-reverting calls are assumed to be successful.
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        if (!_safeTransferFrom(token, from, to, value, true)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Variant of {safeTransfer} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransfer(IERC20 token, address to, uint256 value) internal returns (bool) {
        return _safeTransfer(token, to, value, false);
    }

    /**
     * @dev Variant of {safeTransferFrom} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransferFrom(IERC20 token, address from, address to, uint256 value) internal returns (bool) {
        return _safeTransferFrom(token, from, to, value, false);
    }

    /**
     * @dev Increase the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    /**
     * @dev Decrease the calling contract's allowance toward `spender` by `requestedDecrease`. If `token` returns no
     * value, non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    /**
     * @dev Set the calling contract's allowance toward `spender` to `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful. Meant to be used with tokens that require the approval
     * to be set to zero before setting it to a non-zero value, such as USDT.
     *
     * NOTE: If the token implements ERC-7674, this function will not modify any temporary allowance. This function
     * only sets the "standard" allowance. Any temporary allowance will remain active, in addition to the value being
     * set here.
     */
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        if (!_safeApprove(token, spender, value, false)) {
            if (!_safeApprove(token, spender, 0, true)) revert SafeERC20FailedOperation(address(token));
            if (!_safeApprove(token, spender, value, true)) revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferAndCall, with a fallback to the simple {ERC20} transfer if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that relies on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            safeTransfer(token, to, value);
        } else if (!token.transferAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferFromAndCall, with a fallback to the simple {ERC20} transferFrom if the target
     * has no code. This can be used to implement an {ERC721}-like safe transfer that relies on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferFromAndCallRelaxed(
        IERC1363 token,
        address from,
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        if (to.code.length == 0) {
            safeTransferFrom(token, from, to, value);
        } else if (!token.transferFromAndCall(from, to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} approveAndCall, with a fallback to the simple {ERC20} approve if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * NOTE: When the recipient address (`to`) has no code (i.e. is an EOA), this function behaves as {forceApprove}.
     * Oppositely, when the recipient address (`to`) has code, this function only attempts to call {ERC1363-approveAndCall}
     * once without retrying, and relies on the returned value to be true.
     *
     * Reverts if the returned value is other than `true`.
     */
    function approveAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            forceApprove(token, to, value);
        } else if (!token.approveAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity `token.transfer(to, value)` call, relaxing the requirement on the return value: the
     * return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param to The recipient of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeTransfer(IERC20 token, address to, uint256 value, bool bubble) private returns (bool success) {
        bytes4 selector = IERC20.transfer.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(to, shr(96, not(0))))
            mstore(0x24, value)
            success := call(gas(), token, 0, 0x00, 0x44, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
        }
    }

    /**
     * @dev Imitates a Solidity `token.transferFrom(from, to, value)` call, relaxing the requirement on the return
     * value: the return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param from The sender of the tokens
     * @param to The recipient of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 value,
        bool bubble
    ) private returns (bool success) {
        bytes4 selector = IERC20.transferFrom.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(from, shr(96, not(0))))
            mstore(0x24, and(to, shr(96, not(0))))
            mstore(0x44, value)
            success := call(gas(), token, 0, 0x00, 0x64, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
            mstore(0x60, 0)
        }
    }

    /**
     * @dev Imitates a Solidity `token.approve(spender, value)` call, relaxing the requirement on the return value:
     * the return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param spender The spender of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeApprove(IERC20 token, address spender, uint256 value, bool bubble) private returns (bool success) {
        bytes4 selector = IERC20.approve.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(spender, shr(96, not(0))))
            mstore(0x24, value)
            success := call(gas(), token, 0, 0x00, 0x44, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
        }
    }
}


// File @openzeppelin/contracts/utils/StorageSlot.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

pragma solidity ^0.8.20;

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}


// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 *
 * IMPORTANT: Deprecated. This storage-based reentrancy guard will be removed and replaced
 * by the {ReentrancyGuardTransient} variant in v6.0.
 *
 * @custom:stateless
 */
abstract contract ReentrancyGuard {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    /**
     * @dev A `view` only version of {nonReentrant}. Use to block view functions
     * from being called, preventing reading from inconsistent contract state.
     *
     * CAUTION: This is a "view" modifier and does not change the reentrancy
     * status. Use it only on view functions. For payable or non-payable functions,
     * use the standard {nonReentrant} modifier instead.
     */
    modifier nonReentrantView() {
        _nonReentrantBeforeView();
        _;
    }

    function _nonReentrantBeforeView() private view {
        if (_reentrancyGuardEntered()) {
            revert ReentrancyGuardReentrantCall();
        }
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        _nonReentrantBeforeView();

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}


// File contracts/IQorePqc.sol

// Original license: SPDX_License_Identifier: MIT
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


// File contracts/DeedLockEscrow.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.24;




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
