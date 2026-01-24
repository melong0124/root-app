import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { prisma } from "~/db.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/session.server";

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
    // 인증 체크
    await requireAuth(request);

    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1; // 1-indexed

    // 종료일: 선택한 달의 마지막 날
    const endDate = new Date(year, month, 1);
    // 시작일: 12개월 전 (종료일로부터 12개월 전)
    const startDate = new Date(year, month - 12, 1);

    // 모든 거래 내역 조회 (사용자 구분 없이)
    const transactions = await prisma.transaction.findMany({
        where: {
            date: {
                gte: startDate,
                lt: endDate,
            }
        },
        include: {
            entries: true
        }
    });

    // 월별 통계 계산을 위한 12개월 데이터 슬롯 생성
    const stats: MonthlyStats[] = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        stats.push({
            month: `${m + 1}월`,
            monthFull: `${y}년 ${m + 1}월`,
            income: 0,
            expense: 0,
            netProfit: 0
        });
    }

    transactions.forEach(tx => {
        // 시간대(Asia/Seoul)를 고려하여 tx.date에서 년, 월 추출
        const parts = new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric',
            month: 'numeric',
            timeZone: 'Asia/Seoul'
        }).formatToParts(new Date(tx.date));

        const txYear = parseInt(parts.find(p => p.type === 'year')?.value || "0");
        const txMonth = parseInt(parts.find(p => p.type === 'month')?.value || "0");

        const diffMonths = (txYear - startDate.getFullYear()) * 12 + (txMonth - 1 - startDate.getMonth());

        if (diffMonths >= 0 && diffMonths < 12) {
            const incomeEntry = tx.entries.find(e => Number(e.amount) > 0);
            const amount = incomeEntry ? Number(incomeEntry.amount) : 0;

            if (tx.type === "INCOME") {
                stats[diffMonths].income += amount;
            } else if (tx.type === "EXPENSE") {
                stats[diffMonths].expense += amount;
            }
            stats[diffMonths].netProfit = stats[diffMonths].income - stats[diffMonths].expense;
        }
    });

    return {
        year,
        month,
        stats
    };
}

// --- Component ---

export default function LedgerDashboard() {
    const { year, month, stats } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();

    const changeMonth = (delta: number) => {
        let newMonth = month + delta;
        let newYear = year;

        if (newMonth > 12) {
            newMonth = 1;
            newYear++;
        } else if (newMonth < 1) {
            newMonth = 12;
            newYear--;
        }

        setSearchParams({
            year: newYear.toString(),
            month: newMonth.toString()
        });
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <LayoutDashboard className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">가계부 통계</h1>
                        <p className="text-sm text-muted-foreground">최근 12개월의 수입 및 지출 현황을 분석합니다.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                    <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="px-4 font-bold text-lg">{year}년 {month}월</span>
                    <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-none bg-blue-50 dark:bg-blue-900/10">
                    <CardContent className="pt-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">12개월 총 수입</p>
                        <h3 className="text-2xl font-bold text-blue-700">
                            {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(stats.reduce((acc, curr) => acc + curr.income, 0))}
                        </h3>
                    </CardContent>
                </Card>
                <Card className="border-none bg-red-50 dark:bg-red-900/10">
                    <CardContent className="pt-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">12개월 총 지출</p>
                        <h3 className="text-2xl font-bold text-red-700">
                            {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(stats.reduce((acc, curr) => acc + curr.expense, 0))}
                        </h3>
                    </CardContent>
                </Card>
                <Card className="border-none bg-primary/5">
                    <CardContent className="pt-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">12개월 순손익</p>
                        <h3 className="text-2xl font-bold text-primary">
                            {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(stats.reduce((acc, curr) => acc + curr.netProfit, 0))}
                        </h3>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>월별 수입/지출 추이</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" />
                                <YAxis
                                    tickFormatter={(val: number) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(val)}
                                />
                                <Tooltip
                                    formatter={(val: any) => new Intl.NumberFormat('ko-KR').format(Number(val)) + "원"}
                                />
                                <Legend />
                                <Bar dataKey="income" name="수입" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name="지출" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>월별 내역 상세</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/50 border-b">
                                    <th className="px-4 py-3 text-left">기간</th>
                                    <th className="px-4 py-3 text-right">수입</th>
                                    <th className="px-4 py-3 text-right">지출</th>
                                    <th className="px-4 py-3 text-right font-bold">순손익</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {stats.map((s) => (
                                    <tr key={s.month} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-3">{s.monthFull}</td>
                                        <td className="px-4 py-3 text-right text-blue-600">{new Intl.NumberFormat('ko-KR').format(s.income)}</td>
                                        <td className="px-4 py-3 text-right text-red-500">{new Intl.NumberFormat('ko-KR').format(s.expense)}</td>
                                        <td className={`px-4 py-3 text-right font-bold ${s.netProfit >= 0 ? 'text-primary' : 'text-red-700'}`}>
                                            {new Intl.NumberFormat('ko-KR').format(s.netProfit)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
