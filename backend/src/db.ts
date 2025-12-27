import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if(!DATABASE_URL){
    throw new Error("DATABASE_URL is not set")
}
const pool = new Pool({
    connectionString: DATABASE_URL,
});

export async function connectToDatabase():Promise<void> {
    try{
        const client = await pool.connect();
        await client.query("SELECT 1");
        client.release();
        console.log("Database connection successful");
    }catch(err){
        console.error("Database connection failed", err);
        process.exit(1);
    }
}