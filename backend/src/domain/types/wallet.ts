import { WalletStatus } from "./TxTypes";


export interface Wallet {
  id: number;
  user_id: number;
  balance: bigint;
  currency: string;
  status: WalletStatus;
  version: number;
  created_at: Date;
}