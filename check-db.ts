
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const transactions = await prisma.transaction.findMany({
        include: {
            entries: true,
            user: true
        }
    });
    console.log(JSON.stringify(transactions, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
