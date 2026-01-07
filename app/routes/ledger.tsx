import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/ledger";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Wallet, Minus, Plus, Receipt, Calendar as CalendarIcon, Save, PlusCircle, Trash2, Loader2, CheckCircle2, History, ArrowRight } from "lucide-react";
import { prisma } from "~/db.server";
import { useEffect, useRef, useState } from "react";

export async function loader() {
    const user = await prisma.user.findUnique({
        where: { email: "test@example.com" },
        include: {
            accounts: true,
            transactions: {
                orderBy: { date: 'desc' },
                take: 100, // Increased to show more history
                include: {
                    entries: {
                        include: {
                            account: true
                        }
                    }
                }
            }
        },
    });

    if (!user) {
        throw new Error("User not found");
    }

    const assetAccounts = user.accounts.filter((a: any) => a.type === "ASSET" || a.type === "LIABILITY");
    const expenseAccounts = user.accounts.filter((a: any) => a.type === "EXPENSE");

    // Group transactions by month
    const monthlyGroups: { [key: string]: { transactions: any[], total: number } } = {};

    user.transactions.forEach((tx: any) => {
        const date = new Date(tx.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyGroups[monthKey]) {
            monthlyGroups[monthKey] = { transactions: [], total: 0 };
        }

        const debitEntry = tx.entries.find((e: any) => e.amount > 0);
        const amount = debitEntry ? Number(debitEntry.amount) : 0;

        monthlyGroups[monthKey].transactions.push({
            ...tx,
            date: tx.date.toISOString(),
            entries: tx.entries.map((e: any) => ({
                ...e,
                amount: Number(e.amount)
            }))
        });

        // Calculate total (assuming debit entries represent the transaction amount)
        monthlyGroups[monthKey].total += amount;
    });

    // Convert to sorted array
    const sortedMonths = Object.keys(monthlyGroups)
        .sort((a, b) => b.localeCompare(a))
        .map(month => ({
            month,
            ...monthlyGroups[month]
        }));

    return {
        assetAccounts,
        expenseAccounts,
        userId: user.id,
        recentTransactions: sortedMonths
    };
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "save_transactions") {
        const dates = formData.getAll("date") as string[];
        const descriptions = formData.getAll("description") as string[];
        const amounts = formData.getAll("amount") as string[];
        const creditAccountIds = formData.getAll("creditAccountId") as string[];
        const debitAccountIds = formData.getAll("debitAccountId") as string[];
        const userId = formData.get("userId") as string;

        const transactions = dates.map((date, i) => ({
            date: new Date(date),
            description: descriptions[i],
            amount: parseFloat(amounts[i]),
            creditAccountId: creditAccountIds[i],
            debitAccountId: debitAccountIds[i],
        })).filter(t => t.description && !isNaN(t.amount));

        if (transactions.length === 0) return { error: "입력된 거래가 없습니다." };

        try {
            await prisma.$transaction(
                transactions.map(t => prisma.transaction.create({
                    data: {
                        date: t.date,
                        description: t.description,
                        userId,
                        entries: {
                            create: [
                                { amount: t.amount, accountId: t.debitAccountId }, // Debit
                                { amount: -t.amount, accountId: t.creditAccountId }, // Credit
                            ]
                        }
                    }
                }))
            );
            return { success: true };
        } catch (e) {
            console.error(e);
            return { error: "저장 중 오류가 발생했습니다." };
        }
    }

    return null;
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "가계부 입력 및 조회 - Asset Management" },
        { name: "description", content: "표 형태의 간편한 가계부 입력과 최근 내역 조회를 지원합니다." },
    ];
}

type Row = {
    id: string;
    date: string;
    description: string;
    amount: string;
    creditAccountId: string;
    debitAccountId: string;
};

const KRW = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
});

export default function Ledger() {
    const { assetAccounts, expenseAccounts, userId, recentTransactions } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting" || navigation.state === "loading";
    const formRef = useRef<HTMLFormElement>(null);

    const [rows, setRows] = useState<Row[]>([
        { id: Math.random().toString(), date: new Date().toISOString().split('T')[0], description: "", amount: "", creditAccountId: assetAccounts[0]?.id || "", debitAccountId: expenseAccounts[0]?.id || "" }
    ]);

    useEffect(() => {
        if (actionData?.success) {
            setRows([{ id: Math.random().toString(), date: new Date().toISOString().split('T')[0], description: "", amount: "", creditAccountId: assetAccounts[0]?.id || "", debitAccountId: expenseAccounts[0]?.id || "" }]);
            formRef.current?.reset();
        }
    }, [actionData, assetAccounts, expenseAccounts]);

    const addRow = () => {
        setRows([...rows, { id: Math.random().toString(), date: new Date().toISOString().split('T')[0], description: "", amount: "", creditAccountId: assetAccounts[0]?.id || "", debitAccountId: expenseAccounts[0]?.id || "" }]);
    };

    const removeRow = (id: string) => {
        if (rows.length > 1) {
            setRows(rows.filter(r => r.id !== id));
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-3xl font-bold tracking-tight text-primary">가계부 입출금 기록</h2>
                        <p className="text-muted-foreground text-sm">한 줄에 하나의 거래를 신속하게 입력하세요.</p>
                    </div>
                    <Button variant="outline" type="button" className="flex items-center gap-2" onClick={addRow}>
                        <PlusCircle className="w-4 h-4" />
                        내역 추가
                    </Button>
                </div>

                <Form method="post" ref={formRef}>
                    <input type="hidden" name="userId" value={userId} />
                    <Card className="shadow-lg border-border/40 overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted/50 border-b">
                                            <th className="px-6 py-4 font-semibold text-muted-foreground w-40">날짜</th>
                                            <th className="px-6 py-4 font-semibold text-muted-foreground min-w-[200px]">적요 (내용)</th>
                                            <th className="px-6 py-4 font-semibold text-muted-foreground w-48 text-right">금액 (KRW)</th>
                                            <th className="px-6 py-4 font-semibold text-muted-foreground w-48">출처 (자산 감소)</th>
                                            <th className="px-6 py-4 font-semibold text-muted-foreground w-48">용도 (비용 발생)</th>
                                            <th className="px-6 py-4 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-sm">
                                        {rows.map((row) => (
                                            <tr key={row.id} className="hover:bg-muted/20 transition-colors group">
                                                <td className="px-4 py-3">
                                                    <input type="date" name="date" className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-2 outline-none transition-all text-muted-foreground" defaultValue={row.date} required />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input type="text" name="description" className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-2 outline-none transition-all" placeholder="거래 내용을 입력하세요" required />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="relative inline-block w-full">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">₩</span>
                                                        <input type="number" name="amount" className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-2 pl-6 outline-none transition-all text-right font-mono" placeholder="0" required />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select name="creditAccountId" className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-2 outline-none transition-all appearance-none cursor-pointer" defaultValue={row.creditAccountId}>
                                                        {assetAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select name="debitAccountId" className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-2 outline-none transition-all appearance-none cursor-pointer" defaultValue={row.debitAccountId}>
                                                        {expenseAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button type="button" onClick={() => removeRow(row.id)} className="text-muted-foreground/50 hover:text-destructive transition-colors p-1 opacity-0 group-hover:opacity-100">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-primary/[0.02]">
                                            <td colSpan={6} className="px-6 py-3">
                                                <button type="button" onClick={addRow} className="text-primary hover:underline flex items-center gap-1.5 text-xs font-semibold">
                                                    <PlusCircle className="w-3.5 h-3.5" />
                                                    새로운 거래 행 추가
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                        <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
                            <div>
                                {actionData?.error && <p className="text-destructive text-sm font-semibold">{actionData.error}</p>}
                                {actionData?.success && <p className="text-emerald-600 text-sm font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> 성공적으로 저장되었습니다.</p>}
                            </div>
                            <Button type="submit" name="intent" value="save_transactions" disabled={isSubmitting} className="font-bold flex items-center gap-2 px-8 min-w-[180px]">
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSubmitting ? "저장 중..." : "모든 변경사항 저장"}
                            </Button>
                        </div>
                    </Card>
                </Form>
            </div>

            {/* Transaction History Section */}
            <div className="space-y-8">
                <div className="flex items-center gap-2 text-primary">
                    <History className="w-5 h-5" />
                    <h3 className="text-xl font-bold">거래 내역</h3>
                </div>

                {recentTransactions.length === 0 ? (
                    <Card className="border-border/40 shadow-sm">
                        <CardContent className="px-6 py-10 text-center text-muted-foreground">
                            거래 내역이 없습니다.
                        </CardContent>
                    </Card>
                ) : (
                    recentTransactions.map((group) => (
                        <div key={group.month} className="space-y-3">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-lg font-bold text-foreground">
                                    {group.month.split('-')[0]}년 {parseInt(group.month.split('-')[1])}월
                                </h4>
                                <div className="text-sm font-semibold text-muted-foreground">
                                    월 합계: <span className="text-primary">{KRW.format(group.total)}</span>
                                </div>
                            </div>
                            <Card className="border-border/40 shadow-sm overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted/30 border-b">
                                                    <th className="px-6 py-3 font-semibold text-muted-foreground w-40">날짜</th>
                                                    <th className="px-6 py-3 font-semibold text-muted-foreground">적요</th>
                                                    <th className="px-6 py-3 font-semibold text-muted-foreground text-right w-40">금액</th>
                                                    <th className="px-6 py-3 font-semibold text-muted-foreground">거래 흐름</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {group.transactions.map((tx: any) => {
                                                    const debitEntry = tx.entries.find((e: any) => e.amount > 0);
                                                    const creditEntry = tx.entries.find((e: any) => e.amount < 0);
                                                    const amount = debitEntry ? Math.abs(debitEntry.amount) : 0;
                                                    return (
                                                        <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                                                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                                                {new Date(tx.date).toLocaleDateString('ko-KR')}
                                                            </td>
                                                            <td className="px-6 py-4 font-medium">
                                                                {tx.description}
                                                            </td>
                                                            <td className="px-6 py-4 text-right font-mono font-semibold">
                                                                {KRW.format(amount)}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2 text-xs">
                                                                    <span className="bg-muted px-2 py-1 rounded text-muted-foreground">{creditEntry?.account.name || '알 수 없음'}</span>
                                                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                                                    <span className="bg-primary/10 px-2 py-1 rounded text-primary font-medium">{debitEntry?.account.name || '알 수 없음'}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ))
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-6 pb-12">
                <Card className="border-none bg-muted/30 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Plus className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm mb-1">차변 (Debit) - 용도</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">돈을 어디에 썼는지 기록합니다. (비움, 식비, 교통비 등)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-muted/30 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                                <Minus className="w-5 h-5 text-destructive" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm mb-1">대변 (Credit) - 출처</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">돈이 어디서 나갔는지 기록합니다. (현금, 카드, 통장 등)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
