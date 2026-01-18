import { Router } from "express";
import { WalletController } from "../controllers/wallet.ctrl";
import { TxType } from "../services/wallet.services";

const router = Router();
const ctrl = new WalletController();

// Create Wallet
router.post("/wallets", ctrl.create);

// Transactions
router.post("/wallets/:id/credit", ctrl.handleTransaction(TxType.CREDIT));
router.post("/wallets/:id/debit", ctrl.handleTransaction(TxType.DEBIT));

export default router;