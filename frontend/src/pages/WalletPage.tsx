import { useState } from 'react';
import { apiClient } from '../api/client';
type Wallet = {
    wallet_id: number;
    balance: number;
};

export default function WalletPage() {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const userID = 1;
    const createWallet = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await apiClient.post("/wallets",{
                user_id: userID,
            });
            setWallet(res.data);
        } catch (err: any) {
            setError(err?.error ||  "Failed to create wallet")
        }finally{
            setLoading(false);
        }
    }
    return (
        <div className="p-6 max-w-md mx-auto">
                <h1 className="text-xl font-semibold mb-4">
                    Wallet
                </h1>

                {
                    wallet ? 
                        <div className="border p-4 rounded">
                            <p>
                                <strong>Wallet ID:</strong> {wallet.wallet_id}
                            </p>
                            <p>
                                <strong>Balance:</strong> {wallet.balance}
                            </p>
                        </div>
                     :
                        <div className="mb-4">
                            <button onClick={createWallet} disabled ={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
                                {loading ? "Creating..." : "Create Wallet"}
                               
                            </button>
                        </div>
                }
                {error && (
                    <div className="text-red-600">
                        {error}
                    </div>
                )}

            </div>
      
    );
}
