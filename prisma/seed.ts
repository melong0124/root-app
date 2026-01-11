import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const email = "test@example.com";

    // 1. Upsert Test User
    const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            email,
        },
    });

    console.log(`User created: ${user.email}`);

    // 2. Create Default Accounts (Assets and Expenses)
    const defaultAccounts = [
        // Asset Accounts
        { name: "현금", type: "ASSET" },
        { name: "신용카드", type: "LIABILITY" },
        { name: "입출금통장", type: "ASSET" },
        // Expense Accounts
        { name: "식비", type: "EXPENSE" },
        { name: "교통비", type: "EXPENSE" },
        { name: "생활용품", type: "EXPENSE" },
        { name: "취미/여가", type: "EXPENSE" },
        { name: "기타 비용", type: "EXPENSE" },
        // Revenue Accounts
        { name: "월급", type: "REVENUE" },
        { name: "이자수익", type: "REVENUE" },
    ];

    for (const account of defaultAccounts) {
        await prisma.account.create({
            data: {
                ...account,
                userId: user.id,
            },
        });
    }

    console.log("Default accounts created.");
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
