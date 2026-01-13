import { useState } from 'react';
import { apiClient } from '../api/client';
type Wallet = {
    wallet_id: number;
    balance: number;
};

type RetryRequest = {
    action: "credit" | "debit",
    idempotency_key: string,
    amount: number
}

export default function WalletPage() {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [amount, setAmount] = useState<number>(0);
    const [lastRequest, setLastRequest] = useState<RetryRequest | null>(null);
    const [conncurrentRequestCount, setConcurrentRequestsCount] = useState<string | null>(null);

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
            setLastRequest({
                action: "credit",
                idempotency_key: idempotencyKey,
                amount: amount
            });
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

            setLastRequest({
                action: "debit",
                idempotency_key: idempotencyKey,
                amount: amount
            });
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

    const retryLastRequest = async () => {

        if (!wallet || !lastRequest) {
            setError("No request to retry");
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
                `/wallets/${wallet.wallet_id}/${lastRequest.action}`,
                { amount: lastRequest.amount },
                {
                    headers: {
                        "Idempotency-Key": lastRequest.idempotency_key,
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


    type ConcurrentResult = "success" | "conflict";

    const creditConcurrentRequests = async (): Promise<ConcurrentResult> => {
        if (!wallet) {
            throw new Error("Wallet not created");
        }

        const idempotencyKey = crypto.randomUUID();

        try {
            await apiClient.post(
                `/wallets/${wallet.wallet_id}/credit`,
                { amount },
                {
                    headers: {
                        "Idempotency-Key": idempotencyKey,
                    },
                }
            );

            return "success";
        } catch (err: unknown) {
            if (
                typeof err === "object" &&
                err !== null &&
                "error" in err &&
                typeof (err as { error: unknown }).error === "string"
            ) {
                const message = (err as { error: string }).error;

                if (message === "Wallet update conflict") {
                    return "conflict";
                }
            }
            throw err;
        }
    };

    const concurrentRequests = async () => {
        const requests: Promise<ConcurrentResult>[] = [];

        for (let i = 0; i < 5; i++) {
            requests.push(creditConcurrentRequests());
        }

        const results = await Promise.allSettled(requests);

        let success = 0;
        let conflict = 0;

        for (const r of results) {
            if (r.status === "fulfilled") {
                if (r.value === "success") success++;
                if (r.value === "conflict") conflict++;
            }
        }

        setConcurrentRequestsCount(
            `Out of 5 concurrent requests:
            ${success} succeeded,
            ${conflict} rejected due to optimistic locking`
        );
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
                        <button onClick={creditWallet} disabled={loading} className="m-3 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 select-none">
                            {loading ? "Please wait..." : "Credit"}
                        </button>
                        <button onClick={debitWallet} disabled={loading} className="m-3 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50  select-none">
                            {loading ? "Please wait..." : "Debit"}
                        </button>
                        <button onClick={retryLastRequest} disabled={!lastRequest || loading} className="m-3 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50  select-none">
                            Retry Last Request
                        </button>
                        <button onClick={concurrentRequests} disabled={loading} className="m-3 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50  select-none">
                            Run Concurrent Requests
                        </button>
                        <div className="border p-4 rounded">
                            <p>
                                <strong>{conncurrentRequestCount}</strong>
                            </p>
                        </div>
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
