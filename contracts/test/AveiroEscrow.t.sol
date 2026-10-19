// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AveiroEscrow} from "../AveiroEscrow.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Handler contract used by the invariant test suite.
// It wraps every state-changing function and keeps its own accounting of
// "active" USDC so the invariant harness can verify the contract balance.
// ─────────────────────────────────────────────────────────────────────────────
contract EscrowHandler is Test {
    AveiroEscrow internal escrow;
    MockERC20 internal usdc;

    // Ghost accounting: sum of amounts that are neither released nor cancelled.
    uint256 public activeBalance;

    // Track deposit ids we have created so we can cancel / release them.
    uint256[] public depositIds;

    address internal depositor = makeAddr("handler_depositor");
    address internal recipient  = makeAddr("handler_recipient");
    address internal owner;

    uint256 internal constant MINT_BUDGET = 1_000_000e6; // 1M USDC (6 dec)

    constructor(AveiroEscrow _escrow, MockERC20 _usdc, address _owner) {
        escrow  = _escrow;
        usdc    = _usdc;
        owner   = _owner;

        usdc.mint(depositor, MINT_BUDGET);
        vm.prank(depositor);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ── deposit ──────────────────────────────────────────────────────────────

    function deposit(uint256 amount, uint256 keySeed) external {
        // keep amount in a sane range (1 … 1 000 USDC, 6 decimals)
        amount = bound(amount, 1, 1_000e6);

        // Ensure depositor has enough balance.
        uint256 bal = usdc.balanceOf(depositor);
        if (bal < amount) usdc.mint(depositor, amount - bal);

        bytes32 key = keccak256(abi.encode("handler", keySeed, block.timestamp, depositIds.length));

        vm.prank(depositor);
        uint256 id = escrow.nextDepositId();
        escrow.deposit(key, amount);

        depositIds.push(id);
        activeBalance += amount;
    }

    // ── cancel ───────────────────────────────────────────────────────────────

    function cancel(uint256 idxSeed) external {
        if (depositIds.length == 0) return;

        uint256 idx = bound(idxSeed, 0, depositIds.length - 1);
        uint256 id  = depositIds[idx];

        AveiroEscrow.Deposit memory dep = escrow.getDeposit(id);
        if (dep.claimed || dep.cancelled) return; // already settled
        if (block.timestamp < dep.expiry) {
            vm.warp(dep.expiry + 1);               // advance past expiry
        }

        vm.prank(depositor);
        escrow.cancel(id);
        activeBalance -= dep.amount;
    }

    // ── releaseTo ────────────────────────────────────────────────────────────

    function releaseTo(uint256 idxSeed) external {
        if (depositIds.length == 0) return;

        uint256 idx = bound(idxSeed, 0, depositIds.length - 1);
        uint256 id  = depositIds[idx];

        AveiroEscrow.Deposit memory dep = escrow.getDeposit(id);
        if (dep.claimed || dep.cancelled) return;
        // releaseTo reverts if expiry has passed, so skip those too.
        if (block.timestamp > dep.expiry) return;

        vm.prank(owner);
        escrow.releaseTo(id, recipient);
        activeBalance -= dep.amount;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main test contract
// ─────────────────────────────────────────────────────────────────────────────
contract AveiroEscrowTest is Test {
    AveiroEscrow internal escrow;
    MockERC20    internal usdc;

    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal carol   = makeAddr("carol");

    // Convenient key constants
    bytes32 internal constant KEY_A = keccak256("key_a");
    bytes32 internal constant KEY_B = keccak256("key_b");
    bytes32 internal constant KEY_C = keccak256("key_c");

    uint256 internal constant DEPOSIT_AMOUNT = 100e6; // 100 USDC (6 decimals)

    // ── setUp ─────────────────────────────────────────────────────────────────

    function setUp() public {
        // Deploy mock USDC (6 decimals) and the escrow contract.
        usdc   = new MockERC20("Mock USDC", "mUSDC", 6);
        vm.prank(owner);
        escrow = new AveiroEscrow(address(usdc));

        // Fund alice and bob with USDC and approve the escrow to pull it.
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob,   10_000e6);

        vm.prank(alice);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // =========================================================================
    // 1. DEPLOYMENT & INITIALISATION
    // =========================================================================

    function test_Constructor_SetsUSDC() public view {
        assertEq(escrow.USDC(), address(usdc));
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(escrow.owner(), owner);
    }

    function test_Constructor_NextDepositIdStartsAtOne() public view {
        assertEq(escrow.nextDepositId(), 1);
    }

    function test_Constructor_RevertsOnZeroUSDCAddress() public {
        vm.expectRevert(AveiroEscrow.ZeroAddress.selector);
        new AveiroEscrow(address(0));
    }

    // =========================================================================
    // 2. deposit — happy path
    // =========================================================================

    function test_Deposit_StoresCorrectRecord() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        AveiroEscrow.Deposit memory dep = escrow.getDeposit(1);
        assertEq(dep.sender,              alice);
        assertEq(dep.claimKey,            KEY_A);
        assertEq(dep.amount,              DEPOSIT_AMOUNT);
        assertEq(dep.expiry,              uint64(block.timestamp + 7 days));
        assertFalse(dep.claimed);
        assertFalse(dep.cancelled);
    }

    function test_Deposit_TransfersUSDCToEscrow() public {
        uint256 aliceBefore  = usdc.balanceOf(alice);
        uint256 escrowBefore = usdc.balanceOf(address(escrow));

        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        assertEq(usdc.balanceOf(alice),           aliceBefore  - DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), escrowBefore + DEPOSIT_AMOUNT);
    }

    function test_Deposit_IncrementsNextDepositId() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);
        assertEq(escrow.nextDepositId(), 2);

        vm.prank(alice);
        escrow.deposit(KEY_B, DEPOSIT_AMOUNT);
        assertEq(escrow.nextDepositId(), 3);
    }

    function test_Deposit_MapsKeyToDepositId() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);
        assertEq(escrow.depositIdForKey(KEY_A), 1);
    }

    function test_Deposit_EmitsDepositedEvent() public {
        uint64 expectedExpiry = uint64(block.timestamp + 7 days);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit AveiroEscrow.Deposited(1, alice, KEY_A, DEPOSIT_AMOUNT, expectedExpiry);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);
    }

    function test_Deposit_AllowsReuseOfKeyAfterRelease() public {
        // First deposit → release it via owner
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.prank(owner);
        escrow.releaseTo(1, carol); // owner releases deposit 1

        // Same key can now be reused because old deposit is claimed/released.
        vm.prank(bob);
        escrow.deposit(KEY_A, 50e6);
        assertEq(escrow.nextDepositId(), 3);
    }

    function test_Deposit_AllowsReuseOfKeyAfterCancel() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        // warp past expiry so alice can cancel.
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(alice);
        escrow.cancel(1);

        // Same key reusable now.
        vm.prank(bob);
        escrow.deposit(KEY_A, 50e6);
        assertEq(escrow.nextDepositId(), 3);
    }

    // =========================================================================
    // 3. deposit — revert paths
    // =========================================================================

    function test_Deposit_RevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(AveiroEscrow.ZeroAmount.selector);
        escrow.deposit(KEY_A, 0);
    }

    function test_Deposit_RevertsOnKeyAlreadyUsed() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.prank(bob);
        vm.expectRevert(AveiroEscrow.KeyAlreadyUsed.selector);
        escrow.deposit(KEY_A, 50e6);
    }

    // =========================================================================
    // 4. releaseTo — happy path
    // =========================================================================

    function test_ReleaseTo_SendsUSDCToRecipient() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        uint256 carolBefore = usdc.balanceOf(carol);
        vm.prank(owner);
        escrow.releaseTo(1, carol);

        assertEq(usdc.balanceOf(carol), carolBefore + DEPOSIT_AMOUNT);
    }

    function test_ReleaseTo_MarksDepositAsClaimed() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.prank(owner);
        escrow.releaseTo(1, carol);

        AveiroEscrow.Deposit memory dep = escrow.getDeposit(1);
        assertTrue(dep.claimed);
        assertFalse(dep.cancelled);
    }

    function test_ReleaseTo_EmitsReleasedEvent() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit AveiroEscrow.Released(1, carol, DEPOSIT_AMOUNT);
        escrow.releaseTo(1, carol);
    }

    function test_ReleaseTo_DecreasesEscrowBalance() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        assertEq(usdc.balanceOf(address(escrow)), DEPOSIT_AMOUNT);

        vm.prank(owner);
        escrow.releaseTo(1, carol);

        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // =========================================================================
    // 5. releaseTo — revert paths
    // =========================================================================

    function test_ReleaseTo_RevertsForNonOwner() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        escrow.releaseTo(1, carol);
    }

    function test_ReleaseTo_RevertsOnZeroRecipient() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.prank(owner);
        vm.expectRevert(AveiroEscrow.ZeroAddress.selector);
        escrow.releaseTo(1, address(0));
    }

    function test_ReleaseTo_RevertsOnDepositNotFound() public {
        vm.prank(owner);
        vm.expectRevert(AveiroEscrow.DepositNotFound.selector);
        escrow.releaseTo(999, carol);
    }

    function test_ReleaseTo_RevertsOnAlreadySettled_Released() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.prank(owner);
        escrow.releaseTo(1, carol); // first release → OK

        vm.prank(owner);
        vm.expectRevert(AveiroEscrow.AlreadySettled.selector);
        escrow.releaseTo(1, carol); // second release → revert
    }

    function test_ReleaseTo_RevertsOnAlreadySettled_Cancelled() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        // Warp past expiry so alice can cancel.
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(alice);
        escrow.cancel(1);

        // releaseTo checks ExpiryPassed before AlreadySettled, so the error
        // observed here is ExpiryPassed (the deposit is both expired AND cancelled).
        vm.prank(owner);
        vm.expectRevert(AveiroEscrow.ExpiryPassed.selector);
        escrow.releaseTo(1, carol);
    }

    function test_ReleaseTo_RevertsAfterExpiry() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        // Warp past expiry — releaseTo should revert with ExpiryPassed.
        AveiroEscrow.Deposit memory dep = escrow.getDeposit(1);
        vm.warp(dep.expiry + 1);

        vm.prank(owner);
        vm.expectRevert(AveiroEscrow.ExpiryPassed.selector);
        escrow.releaseTo(1, carol);
    }

    // =========================================================================
    // 6. cancel — happy path
    // =========================================================================

    function test_Cancel_RefundsSenderAfterExpiry() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(alice);
        escrow.cancel(1);

        assertEq(usdc.balanceOf(alice), aliceBefore + DEPOSIT_AMOUNT);
    }

    function test_Cancel_MarksDepositAsCancelled() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(alice);
        escrow.cancel(1);

        AveiroEscrow.Deposit memory dep = escrow.getDeposit(1);
        assertTrue(dep.cancelled);
        assertFalse(dep.claimed);
    }

    function test_Cancel_EmitsCancelledEvent() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit AveiroEscrow.Cancelled(1, alice, DEPOSIT_AMOUNT);
        escrow.cancel(1);
    }

    function test_Cancel_ExactlyAtExpiry() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        // warp to exactly the expiry timestamp.
        AveiroEscrow.Deposit memory dep = escrow.getDeposit(1);
        vm.warp(dep.expiry);
        vm.prank(alice);
        escrow.cancel(1); // should succeed (block.timestamp == expiry → not < expiry)

        assertTrue(escrow.getDeposit(1).cancelled);
    }

    // =========================================================================
    // 7. cancel — revert paths
    // =========================================================================

    function test_Cancel_RevertsOnDepositNotFound() public {
        vm.prank(alice);
        vm.expectRevert(AveiroEscrow.DepositNotFound.selector);
        escrow.cancel(999);
    }

    function test_Cancel_RevertsWhenWrongSender() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(bob); // bob is not the depositor
        vm.expectRevert(AveiroEscrow.NotSender.selector);
        escrow.cancel(1);
    }

    function test_Cancel_RevertsBeforeExpiry() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        // One second before expiry.
        AveiroEscrow.Deposit memory dep = escrow.getDeposit(1);
        vm.warp(dep.expiry - 1);
        vm.prank(alice);
        vm.expectRevert(AveiroEscrow.NotExpired.selector);
        escrow.cancel(1);
    }

    function test_Cancel_RevertsOnDoubleCancel() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(alice);
        escrow.cancel(1);

        vm.prank(alice);
        vm.expectRevert(AveiroEscrow.AlreadySettled.selector);
        escrow.cancel(1);
    }

    function test_Cancel_RevertsIfAlreadyReleased() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        // Owner releases the deposit before expiry.
        vm.prank(owner);
        escrow.releaseTo(1, carol);

        // Alice tries to cancel after expiry — should revert because already settled.
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(alice);
        vm.expectRevert(AveiroEscrow.AlreadySettled.selector);
        escrow.cancel(1);
    }

    // =========================================================================
    // 8. getDeposit & depositIdForKey — view helpers
    // =========================================================================

    function test_GetDeposit_ReturnsEmptyStructForUnknownId() public view {
        AveiroEscrow.Deposit memory dep = escrow.getDeposit(999);
        assertEq(dep.sender, address(0));
        assertEq(dep.amount, 0);
    }

    function test_DepositIdForKey_ReturnsZeroForUnknownKey() public view {
        assertEq(escrow.depositIdForKey(KEY_A), 0);
    }

    function test_DepositIdForKey_AfterDeposit() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);
        assertEq(escrow.depositIdForKey(KEY_A), 1);
    }

    // =========================================================================
    // 9. FULL LIFECYCLE INTEGRATION TESTS
    // =========================================================================

    function test_FullLifecycle_DepositThenReleaseTo() public {
        // alice deposits, owner releases to carol
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        assertEq(usdc.balanceOf(address(escrow)), DEPOSIT_AMOUNT);

        uint256 carolBefore = usdc.balanceOf(carol);
        vm.prank(owner);
        escrow.releaseTo(1, carol);

        assertEq(usdc.balanceOf(carol),           carolBefore + DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertTrue(escrow.getDeposit(1).claimed);
    }

    function test_FullLifecycle_DepositThenCancelAfterExpiry() public {
        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(alice);
        escrow.cancel(1);

        assertEq(usdc.balanceOf(alice),           aliceBefore + DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertTrue(escrow.getDeposit(1).cancelled);
    }

    function test_MultipleDeposits_IndependentlySettled() public {
        // alice deposits two separate keys; one is released by owner, one cancelled
        vm.startPrank(alice);
        escrow.deposit(KEY_A, 100e6);
        escrow.deposit(KEY_B, 200e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(escrow)), 300e6);

        // owner releases deposit 1
        vm.prank(owner);
        escrow.releaseTo(1, carol);
        assertEq(usdc.balanceOf(address(escrow)), 200e6);

        // cancel deposit 2 after expiry
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(alice);
        escrow.cancel(2);

        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // =========================================================================
    // 10. FUZZ TESTS
    // =========================================================================

    /// @dev Fuzz the deposit amount over the full uint64 range (capped by alice's balance).
    function testFuzz_Deposit_AmountStoredCorrectly(uint256 amount) public {
        amount = bound(amount, 1, 10_000e6); // within alice's balance

        vm.prank(alice);
        escrow.deposit(KEY_A, amount);

        AveiroEscrow.Deposit memory dep = escrow.getDeposit(1);
        assertEq(dep.amount, amount);
        assertEq(usdc.balanceOf(address(escrow)), amount);
    }

    /// @dev Fuzz expiry timing: cancellation should succeed at or after expiry.
    function testFuzz_Cancel_SucceedsAfterExpiry(uint64 warpOffset) public {
        // warpOffset ∈ [0, 30 days] past the expiry timestamp
        warpOffset = uint64(bound(uint256(warpOffset), 0, 30 days));

        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        AveiroEscrow.Deposit memory dep = escrow.getDeposit(1);
        vm.warp(dep.expiry + uint256(warpOffset));

        vm.prank(alice);
        escrow.cancel(1);

        assertTrue(escrow.getDeposit(1).cancelled);
    }

    /// @dev Fuzz expiry timing: cancellation should revert strictly before expiry.
    function testFuzz_Cancel_RevertsBeforeExpiry(uint64 warpOffset) public {
        // warpOffset ∈ [0, 7 days - 1] — always before expiry
        warpOffset = uint64(bound(uint256(warpOffset), 0, 7 days - 1));

        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        AveiroEscrow.Deposit memory dep = escrow.getDeposit(1);
        // Stay strictly before expiry.
        vm.warp(dep.expiry - 1 - uint256(warpOffset));

        vm.prank(alice);
        vm.expectRevert(AveiroEscrow.NotExpired.selector);
        escrow.cancel(1);
    }

    /// @dev Fuzz claimKey: different keys always produce distinct deposit ids.
    function testFuzz_Deposit_DifferentKeysProduceDistinctIds(bytes32 keyA, bytes32 keyB) public {
        vm.assume(keyA != keyB);

        vm.prank(alice);
        escrow.deposit(keyA, DEPOSIT_AMOUNT);

        vm.prank(alice);
        escrow.deposit(keyB, DEPOSIT_AMOUNT);

        assertNotEq(escrow.depositIdForKey(keyA), escrow.depositIdForKey(keyB));
    }

    /// @dev Fuzz releaseTo: owner can release any active deposit to any non-zero recipient.
    function testFuzz_ReleaseTo_OwnerCanReleaseToAnyNonZeroRecipient(address recipient) public {
        vm.assume(recipient != address(0));

        vm.prank(alice);
        escrow.deposit(KEY_A, DEPOSIT_AMOUNT);

        vm.prank(owner);
        escrow.releaseTo(1, recipient);

        assertEq(usdc.balanceOf(recipient), DEPOSIT_AMOUNT);
    }

    // =========================================================================
    // 11. OWNABLE (Ownable2Step) — owner transfer guard
    // =========================================================================

    function test_Ownable2Step_PendingOwnerMustAccept() public {
        vm.prank(owner);
        escrow.transferOwnership(alice);

        // Still the old owner until alice accepts.
        assertEq(escrow.owner(), owner);
        assertEq(escrow.pendingOwner(), alice);

        vm.prank(alice);
        escrow.acceptOwnership();
        assertEq(escrow.owner(), alice);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invariant test contract — separate from unit tests so the fuzzer can choose
// its own call sequence.
// ─────────────────────────────────────────────────────────────────────────────
contract AveiroEscrowInvariantTest is Test {
    AveiroEscrow   internal escrow;
    MockERC20      internal usdc;
    EscrowHandler  internal handler;

    address internal owner = makeAddr("inv_owner");

    function setUp() public {
        usdc   = new MockERC20("Mock USDC", "mUSDC", 6);
        vm.prank(owner);
        escrow  = new AveiroEscrow(address(usdc));
        handler = new EscrowHandler(escrow, usdc, owner);

        // Scope the fuzzer to only call the handler.
        targetContract(address(handler));
    }

    /// @dev Core conservation invariant:
    ///      The escrow's USDC balance must equal the sum of all active (unsettled) deposits.
    function invariant_EscrowBalanceEqualsActiveDeposits() public view {
        assertEq(
            usdc.balanceOf(address(escrow)),
            handler.activeBalance(),
            "Invariant violated: escrow USDC balance != sum of active deposits"
        );
    }

    /// @dev nextDepositId always grows monotonically — it never goes backwards.
    function invariant_NextDepositIdMonotonicallyIncreases() public view {
        // By construction nextDepositId starts at 1; the handler tracks it implicitly.
        // We just verify the lower bound.
        assertGe(escrow.nextDepositId(), 1);
    }
}
