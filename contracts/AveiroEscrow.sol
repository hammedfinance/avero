// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title AveiroEscrow
/// @notice Escrows USDC deposits keyed by off-chain claim keys and supports claim, owner release, and sender cancellation after expiry.
/// @dev USDC is a centralized stablecoin; its issuer may freeze this contract address, which can trap funds for active deposits.
contract AveiroEscrow is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Escrow deposit record.
    /// @param sender Original depositor.
    /// @param claimKey Off-chain claim key associated with the intended recipient.
    /// @param amount USDC amount held in escrow.
    /// @param expiry UNIX timestamp when sender cancellation becomes available.
    /// @param claimed Whether funds have been released to a recipient.
    /// @param cancelled Whether funds have been returned to sender.
    struct Deposit {
        address sender;
        bytes32 claimKey;
        uint256 amount;
        uint64 expiry;
        bool claimed;
        bool cancelled;
    }

    error ZeroAmount();
    error KeyAlreadyUsed();
    error DepositNotFound();
    error AlreadySettled();
    error NotSender();
    error NotExpired();
    error ZeroAddress();
    error ExpiryPassed();
    error RenounceNotAllowed();

    event Deposited(
        uint256 indexed depositId,
        address indexed sender,
        bytes32 claimKey,
        uint256 amount,
        uint64 expiry
    );

    event Released(
        uint256 indexed depositId,
        address indexed recipient,
        uint256 amount
    );

    event Cancelled(
        uint256 indexed depositId,
        address indexed sender,
        uint256 amount
    );

    mapping(uint256 => Deposit) public deposits;
    mapping(bytes32 => uint256) public keyToId;

    uint256 public nextDepositId;
    address public immutable USDC;
    uint64 public constant EXPIRY_SECONDS = 7 days;

    /// @notice Initializes the escrow with the USDC token address and sets deployer as owner.
    /// @param usdc ERC-20 USDC token address.
    constructor(address usdc) Ownable(msg.sender) {
        if (usdc == address(0)) revert ZeroAddress();

        USDC = usdc;
        nextDepositId = 1;
    }

    /// @notice Deposits USDC into escrow under a claim key.
    /// @param claimKey Off-chain claim key used later for claiming.
    /// @param amount USDC amount to escrow.
    function deposit(bytes32 claimKey, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 existingId = keyToId[claimKey];
        if (existingId != 0) {
            Deposit storage existing = deposits[existingId];
            if (!existing.claimed && !existing.cancelled) revert KeyAlreadyUsed();
        }

        uint256 depositId = nextDepositId;
        uint64 expiry = uint64(block.timestamp + EXPIRY_SECONDS);

        deposits[depositId] = Deposit({
            sender: msg.sender,
            claimKey: claimKey,
            amount: amount,
            expiry: expiry,
            claimed: false,
            cancelled: false
        });

        keyToId[claimKey] = depositId;
        nextDepositId = depositId + 1;

        uint256 balanceBefore = IERC20(USDC).balanceOf(address(this));
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = IERC20(USDC).balanceOf(address(this));
        deposits[depositId].amount = balanceAfter - balanceBefore;

        emit Deposited(depositId, msg.sender, claimKey, deposits[depositId].amount, expiry);
    }

    /// @notice Cancels an expired deposit and refunds the original sender.
    /// @param depositId Identifier of the deposit to cancel.
    function cancel(uint256 depositId) external nonReentrant {
        Deposit storage dep = deposits[depositId];
        if (dep.sender == address(0)) revert DepositNotFound();
        if (dep.sender != msg.sender) revert NotSender();
        if (block.timestamp < dep.expiry) revert NotExpired();
        if (dep.claimed || dep.cancelled) revert AlreadySettled();

        dep.cancelled = true;

        IERC20(USDC).safeTransfer(dep.sender, dep.amount);

        emit Cancelled(depositId, msg.sender, dep.amount);
    }

    /// @notice Releases an active deposit to a recipient, callable only by owner.
    /// @param depositId Identifier of the deposit to release.
    /// @param recipient Wallet that receives escrowed USDC.
    function releaseTo(uint256 depositId, address recipient)
        external
        onlyOwner
        nonReentrant
    {
        if (recipient == address(0)) revert ZeroAddress();

        Deposit storage dep = deposits[depositId];
        if (dep.sender == address(0)) revert DepositNotFound();
        if (block.timestamp > dep.expiry) revert ExpiryPassed();
        if (dep.claimed || dep.cancelled) revert AlreadySettled();

        dep.claimed = true;

        IERC20(USDC).safeTransfer(recipient, dep.amount);

        emit Released(depositId, recipient, dep.amount);
    }

    /// @notice Returns the full deposit record for an id.
    /// @param depositId Identifier of the deposit.
    /// @return Deposit struct for the provided id.
    function getDeposit(uint256 depositId) external view returns (Deposit memory) {
        return deposits[depositId];
    }

    /// @notice Returns the current deposit id mapped to a claim key.
    /// @param claimKey Claim key to resolve.
    /// @return Deposit id currently associated with the key, or 0 if none.
    function depositIdForKey(bytes32 claimKey) external view returns (uint256) {
        return keyToId[claimKey];
    }

    function renounceOwnership() public override onlyOwner {
        revert RenounceNotAllowed();
    }
}
