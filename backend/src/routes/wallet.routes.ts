import { Router } from "express";
import { WalletController } from "../controllers/wallet.ctrl";
import { TxType } from "../domain/types/TxTypes";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const ctrl = new WalletController();

// Create Wallet
router.post("/wallets", asyncHandler(ctrl.create));

// Transactions
router.post("/wallets/:id/credit", asyncHandler(ctrl.handleTransaction(TxType.CREDIT)));
router.post("/wallets/:id/debit", asyncHandler(ctrl.handleTransaction(TxType.DEBIT)));

export default router;