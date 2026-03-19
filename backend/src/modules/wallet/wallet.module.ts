import { WalletRepository } from "../../repositories/wallet.repo";
import { WalletService } from "../../services/wallet.services";
import { WalletController } from "../../controllers/wallet.ctrl";
import { redisClient } from "../../utils/redis";

export const createWalletModule = () => {

    const walletRepo = new WalletRepository();
    const service = new WalletService(walletRepo, redisClient);
    const controller = new WalletController(service);

    return {controller};

}


