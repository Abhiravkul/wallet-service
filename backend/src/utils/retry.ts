export async function withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3
) : Promise<T> {
    let attempt = 0;

    while(true){
        try{
            return await operation();
        }catch(err){
            attempt++;

            if(attempt > maxAttempts){
                throw err;
            }

            const delay = 10*Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}