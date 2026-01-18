import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if(!DATABASE_URL){
    throw new Error("DATABASE_URL is not set")
}
export const pool = new Pool({
    connectionString: DATABASE_URL,
});

pool
    .query("SELECT 1")
    .then(()=>{
        console.log("Postgres connected");
    })
    .catch((err) => {
        console.error("Postgres connection failed", err);
        process.exit(1);
    })