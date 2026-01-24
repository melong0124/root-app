import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/ledger";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Wallet, Plus, Save, PlusCircle, Trash2, Loader2, CheckCircle2, History, ArrowRight } from "lucide-react";
import { prisma } from "~/db.server";
import { useEffect, useRef, useState } from "react";
import { requireAuth } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
    // 인증 체크 - 로그인하지 않은 경우 /login으로 리다이렉트
    await requireAuth(request);

    // 모든 계정 조회 (사용자 구분 없이)
    const accounts = await prisma.account.findMany();

    // 모든 거래 내역 조회 (사용자 구분 없이)
    const transactions = await prisma.transaction.findMany({
        orderBy: { date: 'desc' },
        take: 100,
        include: {
            entries: {
                include: {
                    account: true
                }
            }
        }
    });

    // 첫 번째 사용자 ID 가져오기 (거래 저장용)
    const firstUser = await prisma.user.findFirst();
    if (!firstUser) {
        throw new Error("No user found in database");
    }

    const assetAccounts = accounts.filter((a: any) => a.type === "ASSET" || a.type === "LIABILITY");
    const expenseAccounts = accounts.filter((a: any) => a.type === "EXPENSE");
    const revenueAccounts = accounts.filter((a: any) => a.type === "REVENUE");

    const monthlyGroups: { [key: string]: { transactions: any[], totalIncome: number, totalExpense: number, net: number } } = {};

    transactions.forEach((tx: any) => {
        const date = new Date(tx.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyGroups[monthKey]) {
            monthlyGroups[monthKey] = { transactions: [], totalIncome: 0, totalExpense: 0, net: 0 };
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

        if (tx.type === "INCOME") {
            monthlyGroups[monthKey].totalIncome += amount;
            monthlyGroups[monthKey].net += amount;
        } else if (tx.type === "EXPENSE") {
            monthlyGroups[monthKey].totalExpense += amount;
            monthlyGroups[monthKey].net -= amount;
        }
    });

    const sortedMonths = Object.keys(monthlyGroups)
        .sort((a, b) => b.localeCompare(a))
        .map(month => ({
            month,
            ...monthlyGroups[month]
        }));

    return {
        assetAccounts,
        expenseAccounts,
        revenueAccounts,
        userId: firstUser.id,
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
        const types = formData.getAll("type") as string[];
        const creditAccountIds = formData.getAll("creditAccountId") as string[];
        const debitAccountIds = formData.getAll("debitAccountId") as string[];
        const userId = formData.get("userId") as string;

        const transactions = dates.map((date, i) => ({
            date: new Date(date),
            description: descriptions[i],
            amount: parseFloat(amounts[i]),
            type: types[i],
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
                        type: t.type as any,
                        userId,
                        entries: {
                            create: [
                                { amount: t.amount, accountId: t.debitAccountId },
                                { amount: -t.amount, accountId: t.creditAccountId },
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
    type: "INCOME" | "EXPENSE";
    creditAccountId: string;
    debitAccountId: string;
};

const KRW = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
});

export default function Ledger() {
    const { assetAccounts, expenseAccounts, revenueAccounts, userId, recentTransactions } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting" || navigation.state === "loading";
    const formRef = useRef<HTMLFormElement>(null);

    const [rows, setRows] = useState<Row[]>([
        { id: Math.random().toString(), date: new Date().toISOString().split('T')[0], description: "", amount: "", type: "EXPENSE", creditAccountId: assetAccounts[0]?.id || "", debitAccountId: expenseAccounts[0]?.id || "" }
    ]);

    useEffect(() => {
        if (actionData?.success) {
            setRows([{ id: Math.random().toString(), date: new Date().toISOString().split('T')[0], description: "", amount: "", type: "EXPENSE", creditAccountId: assetAccounts[0]?.id || "", debitAccountId: expenseAccounts[0]?.id || "" }]);
            formRef.current?.reset();
        }
    }, [actionData, assetAccounts, expenseAccounts]);

    const addRow = () => {
        setRows([...rows, { id: Math.random().toString(), date: new Date().toISOString().split('T')[0], description: "", amount: "", type: "EXPENSE", creditAccountId: assetAccounts[0]?.id || "", debitAccountId: expenseAccounts[0]?.id || "" }]);
    };

    const removeRow = (id: string) => {
        if (rows.length > 1) {
            setRows(rows.filter(r => r.id !== id));
        }
    };

    const updateRow = (id: string, field: keyof Row, value: string) => {
        setRows(rows.map(row => {
            if (row.id === id) {
                const updatedRow = { ...row, [field]: value };
                if (field === "type") {
                    if (value === "INCOME") {
                        updatedRow.creditAccountId = revenueAccounts[0]?.id || "";
                        updatedRow.debitAccountId = assetAccounts[0]?.id || "";
                    } else {
                        updatedRow.creditAccountId = assetAccounts[0]?.id || "";
                        updatedRow.debitAccountId = expenseAccounts[0]?.id || "";
                    }
                }
                return updatedRow;
            }
            return row;
        }));
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4 animate-in fade-in duration-500 pb-20 md:pb-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <h2 className="text-2xl font-bold tracking-tight text-primary">가계부 입출금 기록</h2>
                        <p className="text-muted-foreground text-xs">한 줄에 하나의 거래를 신속하게 입력하세요.</p>
                    </div>
                    <Button variant="outline" size="sm" type="button" className="flex items-center gap-2" onClick={addRow}>
                        <PlusCircle className="w-4 h-4" />
                        <span className="hidden md:inline">내역 추가</span>
                        <span className="md:hidden">추가</span>
                    </Button>
                </div>

                <Form method="post" ref={formRef}>
                    <input type="hidden" name="userId" value={userId} />

                    {/* Desktop Table View */}
                    <Card className="shadow-lg border-border/40 hidden md:block">
                        <CardContent className="p-0 pb-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted/50 border-b">
                                            <th className="px-4 py-3 font-semibold text-muted-foreground w-24">구분</th>
                                            <th className="px-4 py-3 font-semibold text-muted-foreground w-36">날짜</th>
                                            <th className="px-4 py-3 font-semibold text-muted-foreground min-w-[180px]">적요 (내용)</th>
                                            <th className="px-4 py-3 font-semibold text-muted-foreground w-32 text-right">금액 (KRW)</th>
                                            <th className="px-4 py-3 font-semibold text-muted-foreground w-40">출처 (자금원)</th>
                                            <th className="px-4 py-3 font-semibold text-muted-foreground w-40">용도 (도착지)</th>
                                            <th className="px-4 py-1.5 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-sm">
                                        {rows.map((row) => (
                                            <tr key={row.id} className="hover:bg-muted/20 transition-colors group">
                                                <td className="px-4 py-2">
                                                    <select
                                                        name="type"
                                                        className={`w - full bg - transparent border - none focus: ring - 1 focus: ring - primary rounded p - 1.5 outline - none transition - all font - bold ${row.type === 'INCOME' ? 'text-blue-600' : 'text-red-500'} `}
                                                        value={row.type}
                                                        onChange={(e) => updateRow(row.id, "type", e.target.value)}
                                                    >
                                                        <option value="EXPENSE">지출</option>
                                                        <option value="INCOME">수입</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input type="date" name="date" className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-1.5 outline-none transition-all text-muted-foreground" value={row.date} onChange={(e) => updateRow(row.id, "date", e.target.value)} required />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input type="text" name="description" className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-1.5 outline-none transition-all" placeholder="거래 내용을 입력하세요" value={row.description} onChange={(e) => updateRow(row.id, "description", e.target.value)} required />
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <div className="relative inline-block w-full">
                                                        <span className={`absolute left - 2 top - 1 / 2 - translate - y - 1 / 2 font - mono ${row.type === 'INCOME' ? 'text-blue-600/50' : 'text-red-500/50'} `}>₩</span>
                                                        <input
                                                            type="number"
                                                            name="amount"
                                                            className={`w - full bg - transparent border - none focus: ring - 1 focus: ring - primary rounded p - 1.5 pl - 6 outline - none transition - all text - right font - mono font - bold ${row.type === 'INCOME' ? 'text-blue-600' : 'text-red-500'} `}
                                                            placeholder="0"
                                                            value={row.amount}
                                                            onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                                                            required
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <select name="creditAccountId" className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-1.5 outline-none transition-all appearance-none cursor-pointer" value={row.creditAccountId} onChange={(e) => updateRow(row.id, "creditAccountId", e.target.value)}>
                                                        {row.type === "EXPENSE" ?
                                                            assetAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>) :
                                                            revenueAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)
                                                        }
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <select name="debitAccountId" className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary rounded p-2 outline-none transition-all appearance-none cursor-pointer" value={row.debitAccountId} onChange={(e) => updateRow(row.id, "debitAccountId", e.target.value)}>
                                                        {row.type === "EXPENSE" ?
                                                            expenseAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>) :
                                                            assetAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)
                                                        }
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button type="button" onClick={() => removeRow(row.id)} className="text-muted-foreground/50 hover:text-destructive transition-colors p-1 opacity-0 group-hover:opacity-100">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Desktop Add Row Button is outside in header, or we can keep it here contextually if needed, but the header button is better for visibility */}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Mobile Card List Input View */}
                    <div className="md:hidden space-y-4">
                        {rows.map((row, index) => (
                            <Card key={row.id} className="shadow-sm border-l-4 border-l-primary relative">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex gap-2">
                                                <select
                                                    name="type"
                                                    className={`bg - transparent font - bold text - sm outline - none ${row.type === 'INCOME' ? 'text-blue-600' : 'text-red-500'} `}
                                                    value={row.type}
                                                    onChange={(e) => updateRow(row.id, "type", e.target.value)}
                                                >
                                                    <option value="EXPENSE">지출</option>
                                                    <option value="INCOME">수입</option>
                                                </select>
                                                <input
                                                    type="date"
                                                    name="date"
                                                    className="bg-transparent text-sm outline-none text-muted-foreground"
                                                    value={row.date}
                                                    onChange={(e) => updateRow(row.id, "date", e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                name="description"
                                                className="w-full bg-muted/20 rounded px-2 py-1 outline-none font-medium placeholder:text-muted-foreground/50"
                                                placeholder="거래 내용 (예: 점심 식사)"
                                                value={row.description}
                                                onChange={(e) => updateRow(row.id, "description", e.target.value)}
                                                required
                                            />
                                        </div>
                                        <button type="button" onClick={() => removeRow(row.id)} className="text-muted-foreground hover:text-destructive p-1">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className={`font - mono ${row.type === 'INCOME' ? 'text-blue-600' : 'text-red-500'} `}>₩</span>
                                        <input
                                            type="number"
                                            name="amount"
                                            className={`flex - 1 bg - muted / 20 rounded px - 2 py - 1 outline - none text - right font - mono font - bold ${row.type === 'INCOME' ? 'text-blue-600' : 'text-red-500'} `}
                                            placeholder="0"
                                            value={row.amount}
                                            onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-muted-foreground">출처 (From)</span>
                                            <select name="creditAccountId" className="bg-muted/20 rounded p-1.5 outline-none text-xs" value={row.creditAccountId} onChange={(e) => updateRow(row.id, "creditAccountId", e.target.value)}>
                                                {row.type === "EXPENSE" ?
                                                    assetAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>) :
                                                    revenueAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)
                                                }
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-muted-foreground">용도 (To)</span>
                                            <select name="debitAccountId" className="bg-muted/20 rounded p-1.5 outline-none text-xs" value={row.debitAccountId} onChange={(e) => updateRow(row.id, "debitAccountId", e.target.value)}>
                                                {row.type === "EXPENSE" ?
                                                    expenseAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>) :
                                                    assetAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)
                                                }
                                            </select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="px-4 py-4 md:border-t md:bg-muted/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mt-4 md:mt-0 bg-card rounded-lg md:rounded-none border md:border-none shadow-sm md:shadow-none">
                        <div>
                            {actionData?.error && <p className="text-destructive text-sm font-semibold text-center md:text-left">{actionData.error}</p>}
                            {actionData?.success && <p className="text-emerald-600 text-sm font-semibold flex items-center justify-center md:justify-start gap-1.5"><CheckCircle2 className="w-4 h-4" /> 성공적으로 저장되었습니다.</p>}
                        </div>
                        <Button type="submit" name="intent" value="save_transactions" disabled={isSubmitting} className="font-bold flex items-center justify-center gap-2 px-8 min-w-[180px] w-full md:w-auto h-12 md:h-10">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isSubmitting ? "저장 중..." : "모든 변경사항 저장"}
                        </Button>
                    </div>
                </Form>
            </div>

            {/* Transaction History Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                    <History className="w-5 h-5" />
                    <h3 className="text-lg font-bold">거래 내역</h3>
                </div>

                {recentTransactions.length === 0 ? (
                    <Card className="border-border/40 shadow-sm">
                        <CardContent className="px-6 py-10 text-center text-muted-foreground">
                            거래 내역이 없습니다.
                        </CardContent>
                    </Card>
                ) : (
                    recentTransactions.map((group) => (
                        <div key={group.month} className="space-y-2">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-lg font-bold text-foreground">
                                    {group.month.split('-')[0]}년 {parseInt(group.month.split('-')[1])}월
                                </h4>
                                <div className="text-xs flex flex-wrap gap-x-3 md:gap-x-6 gap-y-1 text-muted-foreground items-center justify-end">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">Income</span>
                                        <span className="text-blue-600 font-bold whitespace-nowrap">{KRW.format(group.totalIncome)}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-red-400 opacity-70">Expense</span>
                                        <span className="text-red-500 font-bold whitespace-nowrap">{KRW.format(group.totalExpense)}</span>
                                    </div>
                                    <div className="hidden md:flex flex-col items-end bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 shadow-sm">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Monthly Net</span>
                                        <span className={`font - bold whitespace - nowrap ${group.net >= 0 ? 'text-primary' : 'text-red-600'} `}>
                                            {group.net > 0 ? '+' : ''}{KRW.format(group.net)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Desktop Table Transaction View */}
                            <Card className="border-border/40 shadow-sm overflow-hidden hidden md:block">
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted/30 border-b">
                                                    <th className="px-4 py-2 font-semibold text-muted-foreground w-20">구분</th>
                                                    <th className="px-4 py-2 font-semibold text-muted-foreground w-32">날짜</th>
                                                    <th className="px-4 py-2 font-semibold text-muted-foreground">적요 (내역)</th>
                                                    <th className="px-4 py-2 font-semibold text-muted-foreground text-right w-36">금액</th>
                                                    <th className="px-4 py-2 font-semibold text-muted-foreground w-64">거래 흐름</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {group.transactions.map((tx: any) => {
                                                    const debitEntry = tx.entries.find((e: any) => e.amount > 0);
                                                    const creditEntry = tx.entries.find((e: any) => e.amount < 0);
                                                    const amount = debitEntry ? Math.abs(debitEntry.amount) : 0;
                                                    const isIncome = tx.type === "INCOME";
                                                    return (
                                                        <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <span className={`text - [11px] font - bold px - 2 py - 1 rounded - md shadow - sm ${isIncome ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-500 border border-red-100'} `}>
                                                                    {isIncome ? '수입' : '지출'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                                                                {new Date(tx.date).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                                            </td>
                                                            <td className="px-4 py-3 font-medium max-w-[300px] truncate">
                                                                {tx.description}
                                                            </td>
                                                            <td className={`px - 4 py - 3 text - right font - mono font - bold ${isIncome ? 'text-blue-600' : 'text-red-500'} `}>
                                                                {isIncome ? '+' : '-'}{KRW.format(amount)}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2 text-xs">
                                                                    <span className="bg-muted px-2 py-1 rounded text-muted-foreground whitespace-nowrap">{creditEntry?.account.name || '알 수 없음'}</span>
                                                                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                                                    <span className={`px - 2 py - 1 rounded font - medium whitespace - nowrap ${isIncome ? 'bg-blue-50 text-blue-600' : 'bg-primary/10 text-primary'} `}>{debitEntry?.account.name || '알 수 없음'}</span>
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

                            {/* Mobile Card Transaction View */}
                            <div className="md:hidden space-y-3">
                                {group.transactions.map((tx: any) => {
                                    const debitEntry = tx.entries.find((e: any) => e.amount > 0);
                                    const creditEntry = tx.entries.find((e: any) => e.amount < 0);
                                    const amount = debitEntry ? Math.abs(debitEntry.amount) : 0;
                                    const isIncome = tx.type === "INCOME";
                                    return (
                                        <Card key={tx.id} className="shadow-sm border-l-4 border-l-transparent hover:bg-muted/5 active:bg-muted/10 transition-colors" style={{ borderLeftColor: isIncome ? '#2563eb' : '#ef4444' }}>
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text - [10px] font - bold px - 1.5 py - 0.5 rounded ${isIncome ? 'bg-blue-100 text-blue-700' : 'bg-red-50 text-red-500'} `}>
                                                                {isIncome ? '수입' : '지출'}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(tx.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <span className="font-semibold text-sm line-clamp-1">{tx.description}</span>
                                                    </div>
                                                    <span className={`font - mono font - bold ${isIncome ? 'text-blue-600' : 'text-red-500'} `}>
                                                        {isIncome ? '+' : '-'}{KRW.format(amount)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs pt-2 border-t mt-2">
                                                    <span className="text-muted-foreground truncate max-w-[40%]">{creditEntry?.account.name || '알 수 없음'}</span>
                                                    <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                                                    <span className={`truncate max - w - [40 %] ${isIncome ? 'text-blue-600' : 'text-primary'} `}>{debitEntry?.account.name || '알 수 없음'}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="hidden md:grid md:grid-cols-2 gap-4 pb-8">
                <Card className="border-none bg-muted/30 shadow-none">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Plus className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm mb-1">지출 (Expense) - 흐름</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">자산(출처)이 감소하고 비용(용도)이 발생합니다. (통장 → 식비)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-muted/30 shadow-none">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <PlusCircle className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm mb-1">수입 (Income) - 흐름</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">수익(출처)이 발생하고 자산(용도)이 증가합니다. (월급 → 통장)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
