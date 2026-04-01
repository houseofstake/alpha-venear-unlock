"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isUnlockReady } from "@/lib/timeUtils";
import Big from "big.js";
import type { StakingPoolInfo } from "@/types/venear";

const formatNearAmount = (yoctoAmount: string): string => {
  try {
    return Big(yoctoAmount).div(Big(10).pow(24)).toFixed(4);
  } catch {
    return "0";
  }
};

interface UnlockActionsProps {
  lockedBalance: string;
  pendingBalance: string;
  liquidBalance?: string;
  unlockTimestamp: string | null;
  stakingInfo: StakingPoolInfo | null;
  loading: boolean;
  error: string | null;
  onBeginUnlock: () => Promise<void>;
  onEndUnlock: () => Promise<void>;
  onTransfer?: (receiverId?: string) => Promise<void>;
  onDeleteLockup?: () => Promise<void>;
}

export function UnlockActions({
  lockedBalance,
  pendingBalance,
  liquidBalance = "0",
  unlockTimestamp,
  stakingInfo,
  loading,
  error,
  onBeginUnlock,
  onEndUnlock,
  onTransfer,
  onDeleteLockup,
}: UnlockActionsProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const threshold = Big(0); // 0 NEAR threshold, any balance allows actions
  const hasLocked = Big(lockedBalance).gt(threshold);
  const hasPending = Big(pendingBalance).gt(threshold);
  const hasLiquid = Big(liquidBalance || "0").gt(threshold);
  const hasUnlockPending = unlockTimestamp && unlockTimestamp !== "0";

  // Check if unlock period is complete - NOT blocked by staking
  const canCompleteUnlock =
    unlockTimestamp && unlockTimestamp !== "0" && isUnlockReady(unlockTimestamp);

  // Check staking status for messaging
  const totalInPool = stakingInfo
    ? Big(stakingInfo.stakedBalance || "0").plus(Big(stakingInfo.unstakedBalance || "0"))
    : Big(0);

  const hasFundsInPool = totalInPool.gt(0.01);

  // Check if lockup can be deleted - requires EXACTLY zero balances
  // The smart contract enforces strict zero balance
  const hasAnyLockedBalance = Big(lockedBalance).gt(0);
  const hasAnyPendingBalance = Big(pendingBalance).gt(0);
  const hasAnyLiquidBalance = Big(liquidBalance || "0").gt(0);

  const canDeleteLockup =
    !hasAnyLockedBalance &&
    !hasAnyPendingBalance &&
    !hasAnyLiquidBalance &&
    !hasFundsInPool &&
    onDeleteLockup !== undefined;

  const handleBeginUnlock = async () => {
    try {
      setActionError(null);
      setShowConfirmation(false);
      await onBeginUnlock();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to start unlock");
    }
  };

  const handleCompleteUnlock = async () => {
    try {
      setActionError(null);
      await onEndUnlock();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to complete unlock");
    }
  };

  const handleTransfer = async () => {
    if (!onTransfer) return;
    try {
      setActionError(null);
      setShowTransferConfirm(false);
      // Transfer all liquid balance to user's wallet
      await onTransfer();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to transfer");
    }
  };

  const handleDeleteLockup = async () => {
    if (!onDeleteLockup) return;
    try {
      setActionError(null);
      setShowDeleteConfirm(false);
      await onDeleteLockup();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete lockup";

      // Enhanced error messages for common issues
      if (
        errorMessage.includes("non-zero locked") ||
        errorMessage.includes("non-zero balance") ||
        errorMessage.includes("panicked at lockup-contract")
      ) {
        setActionError(
          "Deletion failed: Your lockup contract still has remaining balances. " +
            "Ensure all locked, pending, and liquid balances are exactly zero. Use the action buttons above.",
        );
      } else {
        setActionError(errorMessage);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unlock Actions</CardTitle>
        <CardDescription>Manage your veNEAR unlocking process</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(error || actionError) && (
          <Alert variant="destructive">
            <AlertDescription>{error || actionError}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Start Unlock */}
        {hasLocked && !hasUnlockPending && (
          <div className="space-y-2">
            {!showConfirmation ? (
              <>
                <Button
                  onClick={() => setShowConfirmation(true)}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  Start Unlock (91.25 Days)
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Initiates a 91.25-day unlock period for all locked tokens
                </p>
              </>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertDescription>
                    <div className="space-y-3">
                      <p className="font-semibold">Confirm: Start Unlock Process?</p>
                      <p className="text-sm">
                        This will begin the 91.25-day unlock period. You cannot reverse this action.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleBeginUnlock}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          {loading ? "Processing..." : "Yes, Start Unlock"}
                        </Button>
                        <Button
                          onClick={() => setShowConfirmation(false)}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        )}

        {/* Step 2: Complete Unlock */}
        {canCompleteUnlock && hasPending && (
          <div className="space-y-2">
            <Button
              onClick={handleCompleteUnlock}
              disabled={loading}
              className="w-full"
              variant="default"
              size="lg"
            >
              {loading ? "Processing..." : "Complete Unlock"}
            </Button>
            <p className="text-xs text-green-600 dark:text-green-400 text-center font-medium">
              ✓ Unlock period complete! Click to finalize.
            </p>
            {hasFundsInPool && (
              <Alert variant="default" className="mt-2">
                <AlertDescription className="text-sm">
                  <strong>Note:</strong> You have{" "}
                  {formatNearAmount(totalInPool.mul(Big(10).pow(24)).toFixed(0))} NEAR in the
                  staking pool. You can complete unlock now, but you&apos;ll need to withdraw from
                  the pool before transferring those funds to your wallet.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 3: Transfer to Wallet */}
        {hasLiquid && onTransfer && (
          <div className="space-y-2">
            {!showTransferConfirm ? (
              <>
                <Button
                  onClick={() => setShowTransferConfirm(true)}
                  disabled={loading}
                  className="w-full"
                  variant="secondary"
                  size="lg"
                >
                  Transfer {formatNearAmount(liquidBalance || "0")} NEAR to My Wallet
                  {hasFundsInPool && " (partial)"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {hasFundsInPool
                    ? `Transfers liquid balance only. ${formatNearAmount(totalInPool.mul(Big(10).pow(24)).toFixed(0))} NEAR remains in staking pool.`
                    : "Move NEAR from lockup contract to your wallet"}
                </p>
              </>
            ) : (
              <>
                <Alert variant="default">
                  <AlertDescription>
                    <div className="space-y-3">
                      <p className="font-semibold">Confirm Transfer</p>
                      <p className="text-sm">
                        Transfer {formatNearAmount(liquidBalance || "0")} NEAR to your wallet?
                      </p>
                      {hasFundsInPool && (
                        <p className="text-xs text-muted-foreground">
                          Note: {formatNearAmount(totalInPool.mul(Big(10).pow(24)).toFixed(0))} NEAR
                          in staking pool will not be transferred. Withdraw from the pool first to
                          transfer those funds.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          onClick={handleTransfer}
                          disabled={loading}
                          variant="default"
                          size="sm"
                        >
                          {loading ? "Processing..." : "Yes, Transfer"}
                        </Button>
                        <Button
                          onClick={() => setShowTransferConfirm(false)}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        )}

        {hasUnlockPending && !canCompleteUnlock && (
          <div className="text-center space-y-2 py-4">
            <p className="text-sm text-muted-foreground">
              Unlock in progress. Complete Unlock button will appear when the 91.25-day period ends.
            </p>
          </div>
        )}

        {/* Balance Warning - appears when balances exist but are too small to display with threshold */}
        {!canDeleteLockup &&
          !hasLocked &&
          !hasPending &&
          !hasLiquid &&
          !hasFundsInPool &&
          (hasAnyLockedBalance || hasAnyPendingBalance || hasAnyLiquidBalance) &&
          onDeleteLockup && (
            <Alert variant="default" className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    ⚠️ Small Balance Detected
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Your lockup contract has very small remaining balances that prevent deletion.
                    The smart contract requires EXACTLY zero balances.
                  </p>
                  {hasAnyLockedBalance && (
                    <p className="text-xs font-mono text-amber-600 dark:text-amber-400">
                      Locked: {lockedBalance} yoctoNEAR - Use &quot;Start Unlock&quot; (unlocks ALL
                      locked)
                    </p>
                  )}
                  {hasAnyPendingBalance && (
                    <p className="text-xs font-mono text-amber-600 dark:text-amber-400">
                      Pending: {pendingBalance} yoctoNEAR - Use &quot;Complete Unlock&quot; after
                      91.25 days (completes ALL pending)
                    </p>
                  )}
                  {hasAnyLiquidBalance && (
                    <p className="text-xs font-mono text-amber-600 dark:text-amber-400">
                      Liquid: {liquidBalance} yoctoNEAR - Use &quot;Transfer&quot; (transfers ALL
                      liquid)
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

        {/* Pre-Deletion Checklist - appears when preparing for deletion */}
        {!canDeleteLockup &&
          !hasLocked &&
          !hasPending &&
          !hasLiquid &&
          !hasFundsInPool &&
          !hasAnyLockedBalance &&
          !hasAnyPendingBalance &&
          !hasAnyLiquidBalance &&
          onDeleteLockup && (
            <Alert variant="default" className="bg-green-50 dark:bg-green-950/20 border-green-200">
              <AlertDescription>
                <div className="space-y-3">
                  <p className="font-semibold text-green-800 dark:text-green-200">
                    ✓ Ready to Delete Lockup Contract
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    All balances are exactly zero. You can now safely delete the lockup contract to
                    recover your ~2 NEAR deployment funds.
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-green-800 dark:text-green-200">
                      Pre-deletion Checklist:
                    </p>
                    <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                      <li className="flex items-center gap-2">
                        <span>✓</span>
                        <span>Locked balance: 0 yoctoNEAR</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>✓</span>
                        <span>Pending balance: 0 yoctoNEAR</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>✓</span>
                        <span>Liquid balance: 0 yoctoNEAR</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>✓</span>
                        <span>No funds in staking pool</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

        {/* Delete Lockup - Final Step */}
        {canDeleteLockup && (
          <div className="space-y-2">
            {!showDeleteConfirm ? (
              <>
                <Alert variant="default" className="bg-red-50 dark:bg-red-950/20 border-red-200">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold text-red-800 dark:text-red-200">
                        Ready to Recover Deployment Funds
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        All funds have been withdrawn. You can now delete the lockup contract to
                        recover the ~2 NEAR deployment funds back to your wallet.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                  size="lg"
                >
                  Delete Lockup Contract & Recover Deployment Funds
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  This will permanently delete the lockup contract and return the ~2 NEAR deployment
                  funds to your wallet
                </p>
              </>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertDescription>
                    <div className="space-y-3">
                      <p className="font-semibold">⚠️ Confirm: Delete Lockup Contract?</p>
                      <p className="text-sm">
                        This action is <strong>PERMANENT</strong> and cannot be reversed. The lockup
                        contract will be completely deleted, and the ~2 NEAR deployment funds will
                        be returned to your wallet.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleDeleteLockup}
                          disabled={loading}
                          variant="destructive"
                          size="sm"
                          className="text-white"
                        >
                          {loading ? "Deleting..." : "Yes, Delete Contract"}
                        </Button>
                        <Button
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        )}

        {!hasLocked && !hasPending && !hasLiquid && !canDeleteLockup && (
          <div className="text-center space-y-2 py-4">
            <p className="text-sm text-muted-foreground">No tokens available to unlock</p>
          </div>
        )}

        <div className="mt-6 p-4 rounded-lg bg-muted text-sm space-y-2">
          <p className="font-semibold">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Click &ldquo;Start Unlock&rdquo; to begin the 91.25-day unlock period</li>
            <li>Wait 91.25 days for the unlock timer to complete</li>
            <li>
              Click &ldquo;Complete Unlock&rdquo; to finalize (works even if funds are staked)
            </li>
            <li>If you have staked funds, withdraw them using the Staking Status card above</li>
            <li>Click &ldquo;Transfer to My Wallet&rdquo; to move liquid NEAR to your wallet</li>
            <li>(Optional) Delete the lockup contract to recover the ~2 NEAR deployment funds</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Note:</strong> You can only transfer NEAR that&apos;s in your lockup contract
            (liquid balance). Staked funds must be withdrawn from the staking pool first.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
