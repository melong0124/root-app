import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import { prisma } from "~/db.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from "recharts";
import { ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { Button } from "~/components/ui/button";

// --- Types ---

interface MonthlyStats {
    month: string;
    monthFull: string;
    income: number;
    expense: number;
    netProfit: number;
}

// --- Loader ---

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    const now = new Date();
    const endYear = yearParam ? parseInt(yearParam) : now.getFullYear();
    const endMonth = monthParam ? parseInt(monthParam) : now.getMonth() + 1; // 1-12

    // Set end date to the last day of the selected month
    const endDate = new Date(endYear, endMonth, 0, 23, 59, 59, 999);
    // Set start date to the first day of the month 11 months ago
    const startDate = new Date(endYear, endMonth - 12, 1);

    const transactions = await prisma.transaction.findMany({
        where: {
            user: { email: "test@example.com" },
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
        include: {
            entries: true,
        },
    });

    const statsMap: Map<string, MonthlyStats> = new Map();

    // Initialize the last 12 months
    for (let i = 0; i < 12; i++) {
        const d = new Date(endYear, endMonth - 12 + i, 1);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const key = `${year}-${String(month).padStart(2, '0')}`;
        statsMap.set(key, {
            month: `${month}월`,
            monthFull: `${year}년 ${month}월`,
            income: 0,
            expense: 0,
            netProfit: 0,
        });
    }

    transactions.forEach((tx) => {
        const d = new Date(tx.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const stats = statsMap.get(key);
        if (stats) {
            // Calculate amount from entries. In this schema, amount is stored in entries.
            // Based on ledger.tsx logic:
            const debitEntry = tx.entries.find((e) => e.amount.toNumber() > 0);
            const amount = debitEntry ? Math.abs(debitEntry.amount.toNumber()) : 0;

            if (tx.type === "INCOME") {
                stats.income += amount;
                stats.netProfit += amount;
            } else if (tx.type === "EXPENSE") {
                stats.expense += amount;
                stats.netProfit -= amount;
            }
        }
    });

    const monthlyData = Array.from(statsMap.values());

    return {
        monthlyData,
        endYear,
        endMonth,
    };
}

// --- Component ---

export default function LedgerDashboard() {
    const { monthlyData, endYear, endMonth } = useLoaderData<typeof loader>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const updateDate = (year: number, month: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("year", year.toString());
        params.set("month", month.toString());
        navigate(`?${params.toString()}`);
    };

    const handlePrev = () => {
        let newMonth = endMonth - 1;
        let newYear = endYear;
        if (newMonth === 0) {
            newMonth = 12;
            newYear--;
        }
        updateDate(newYear, newMonth);
    };

    const handleNext = () => {
        let newMonth = endMonth + 1;
        let newYear = endYear;
        if (newMonth === 13) {
            newMonth = 1;
            newYear++;
        }
        updateDate(newYear, newMonth);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: 'KRW',
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(value);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background border border-border rounded-lg shadow-md p-3">
                    <p className="font-bold text-sm mb-1">{payload[0].payload.monthFull}</p>
                    {payload.map((p: any, idx: number) => (
                        <p key={idx} className="text-sm font-medium" style={{ color: p.fill }}>
                            {p.name}: {new Intl.NumberFormat('ko-KR').format(p.value)}원
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg text-primary">
                        <LayoutDashboard className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">가계부 통계 리포트</h1>
                        <p className="text-muted-foreground text-sm">최근 12개월간의 수입과 지출 흐름을 분석합니다.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-muted/40 p-1.5 rounded-xl border border-border/50">
                    <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8 hover:bg-background">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm font-bold px-2 min-w-[120px] text-center">
                        {endYear}년 {endMonth}월 기준
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 hover:bg-background">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Income Graph */}
            <Card className="overflow-hidden border-none shadow-sm ring-1 ring-border/50">
                <CardHeader className="bg-blue-50/50 border-b border-blue-100/50 py-3">
                    <CardTitle className="text-sm font-bold text-blue-700 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-600" />
                        월별 수입 흐름
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                <Bar dataKey="income" name="수입" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Expense Graph */}
            <Card className="overflow-hidden border-none shadow-sm ring-1 ring-border/50">
                <CardHeader className="bg-red-50/50 border-b border-red-100/50 py-3">
                    <CardTitle className="text-sm font-bold text-red-700 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-600" />
                        월별 지출 흐름
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                <Bar dataKey="expense" name="지출" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Net Profit Graph */}
            <Card className="overflow-hidden border-none shadow-sm ring-1 ring-border/50">
                <CardHeader className="bg-slate-50 border-b border-slate-200/50 py-3">
                    <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-600" />
                        월별 순익 (수입 - 지출)
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                                <Bar dataKey="netProfit" name="순익" barSize={24}>
                                    {monthlyData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.netProfit >= 0 ? "#2563eb" : "#ef4444"}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50/30 border-blue-100">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold text-blue-600 uppercase mb-1">최근 1년 총 수입</p>
                        <h3 className="text-xl font-bold">{new Intl.NumberFormat('ko-KR').format(monthlyData.reduce((acc, curr) => acc + curr.income, 0))}원</h3>
                    </CardContent>
                </Card>
                <Card className="bg-red-50/30 border-red-100">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold text-red-600 uppercase mb-1">최근 1년 총 지출</p>
                        <h3 className="text-xl font-bold">{new Intl.NumberFormat('ko-KR').format(monthlyData.reduce((acc, curr) => acc + curr.expense, 0))}원</h3>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold text-slate-600 uppercase mb-1">최근 1년 총 순익</p>
                        <h3 className={`text-xl font-bold ${monthlyData.reduce((acc, curr) => acc + curr.netProfit, 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {new Intl.NumberFormat('ko-KR').format(monthlyData.reduce((acc, curr) => acc + curr.netProfit, 0))}원
                        </h3>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
