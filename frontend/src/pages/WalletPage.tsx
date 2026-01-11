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
    const [amount, setAmount] = useState<number>(0);


    const userID = 1;
    const creditWallet = async () => {

        const idempotencyKey = crypto.randomUUID();
        if (!wallet) {
            setError("Wallet not created yet");
            return;
        }
        if (amount <= 0) {
            setError("Amount must be a positive number");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.post(
                `/wallets/${wallet.wallet_id}/credit`,
                { amount },
                {
                    headers: {
                        "Idempotency-Key": idempotencyKey,
                    },
                }
            );
            setWallet(prevWallet =>
                prevWallet
                    ? {
                        ...prevWallet,
                        balance: Number(res.data.balance),
                    }
                    : prevWallet
            );
        } catch (err: unknown) {
            if (typeof err === "object" && err !== null && "error" in err) {
                setError(String((err as { error: string }).error));
            } else {
                setError("Failed to update wallet");
            }
        } finally {
            setLoading(false);
        }

    }

    const debitWallet = async () => {


        if (!wallet) {
            setError("Wallet not created yet");
            return;
        }
        if (amount <= 0) {
            setError("Amount must be a positive number");
            return;
        }
        const idempotencyKey = crypto.randomUUID();

        setLoading(true);
        setError(null);

        try {
            const res = await apiClient.post(
                `/wallets/${wallet.wallet_id}/debit`,
                { amount },
                {
                    headers: {
                        "Idempotency-Key": idempotencyKey,
                    },
                }
            );

            setWallet(prevWallet =>
                prevWallet
                    ? {
                        ...prevWallet,
                        balance: Number(res.data.balance),
                    }
                    : prevWallet
            );
        } catch (err: unknown) {
            if (typeof err === "object" && err !== null && "error" in err) {
                setError(String((err as { error: string }).error));
            } else {
                setError("Failed to update wallet");
            }
        } finally {
            setLoading(false);
        }
    }
    const createWallet = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await apiClient.post("/wallets", {
                user_id: userID,
            });
            setWallet(res.data);
        } catch (err: unknown) {
            if (typeof err === "object" && err !== null && "error" in err) {
                setError(String((err as { error: string }).error));
            } else {
                setError("Failed to create wallet");
            }
        }
        finally {
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
                        <input
                            type="number"
                            className="border px-3 py-2 rounded w-full mb-3"
                            onChange={(e) => setAmount(Number(e.target.value))}
                        />
                        <button onClick={creditWallet} disabled={loading} className="mr-3 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
                            {loading ? "Please wait..." : "Credit"}
                        </button>
                        <button onClick={debitWallet} disabled={loading} className="mr-3 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
                            {loading ? "Please wait..." : "Debit"}
                        </button>
                    </div>
                    :
                    <div className="mb-4">
                        <button onClick={createWallet} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
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
