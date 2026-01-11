import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { prisma } from "~/db.server";
import { YearSelector } from "~/components/year-selector";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";

// --- Types & Enums ---

enum AssetCategory {
    CASH = "CASH",
    STOCK = "STOCK",
    PENSION = "PENSION",
    REAL_ESTATE = "REAL_ESTATE",
    LOAN = "LOAN",
    ESO = "ESO",
    RENTAL = "RENTAL",
}

const LIABILITY_CATEGORIES = [AssetCategory.LOAN];

function isLiability(category: AssetCategory): boolean {
    return LIABILITY_CATEGORIES.includes(category);
}

// --- Loader ---

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();

    // Fetch User with assets
    const user = await prisma.user.findUnique({
        where: { email: "test@example.com" },
        include: {
            assets: {
                include: {
                    values: {
                        where: {
                            date: {
                                gte: new Date(year, 0, 1), // January 1st
                                lte: new Date(year, 11, 31), // December 31st
                            }
                        },
                    },
                },
            },
        },
    });

    if (!user) throw new Error("User not found");

    // Initialize monthly data structure
    const monthlyData: Array<{
        month: string;
        monthNumber: number;
        totalAssets: number;
        totalLiabilities: number;
        netWorth: number;
        netWorthChange: number;
    }> = [];

    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

    // Process each month (1-12)
    for (let month = 1; month <= 12; month++) {
        const targetDate = new Date(year, month - 1, 1);

        let totalAssets = 0;
        let totalLiabilities = 0;

        // Calculate totals for this month
        user.assets.forEach((asset) => {
            const valueRecord = asset.values.find((v: any) =>
                v.date.getTime() === targetDate.getTime()
            );
            const assetValue = valueRecord?.amount?.toNumber() ?? 0;

            const category = asset.category as AssetCategory;
            if (isLiability(category)) {
                totalLiabilities += assetValue;
            } else {
                totalAssets += assetValue;
            }
        });

        const netWorth = totalAssets - totalLiabilities;

        monthlyData.push({
            month: monthNames[month - 1],
            monthNumber: month,
            totalAssets,
            totalLiabilities,
            netWorth,
            netWorthChange: 0, // Will be calculated after all months are processed
        });
    }

    // Calculate month-over-month changes
    for (let i = 0; i < monthlyData.length; i++) {
        if (i === 0) {
            // For the first month, compare with previous year's December if available
            monthlyData[i].netWorthChange = 0;
        } else {
            monthlyData[i].netWorthChange = monthlyData[i].netWorth - monthlyData[i - 1].netWorth;
        }
    }

    // Calculate yearly summary
    const yearlyTotalAssets = monthlyData.reduce((sum, m) => sum + m.totalAssets, 0) / 12;
    const yearlyTotalLiabilities = monthlyData.reduce((sum, m) => sum + m.totalLiabilities, 0) / 12;
    const yearlyNetWorth = yearlyTotalAssets - yearlyTotalLiabilities;

    // Get last month's data for comparison
    const lastMonthData = monthlyData[11]; // December
    const firstMonthData = monthlyData[0]; // January
    const yearChange = lastMonthData.netWorth - firstMonthData.netWorth;

    return {
        year,
        monthlyData,
        yearlyTotalAssets,
        yearlyTotalLiabilities,
        yearlyNetWorth,
        yearChange,
        userId: user.id,
    };
}

// --- Component ---

export default function DashboardPage() {
    const {
        year,
        monthlyData,
        yearlyTotalAssets,
        yearlyTotalLiabilities,
        yearlyNetWorth,
        yearChange,
    } = useLoaderData<typeof loader>();

    // Custom tooltip for the chart
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const change = payload[0].value;
            const isPositive = change > 0;
            const isNegative = change < 0;

            return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3">
                    <p className="font-semibold text-sm mb-1">{payload[0].payload.month}</p>
                    <p className={`text-sm font-bold ${isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'}`}>
                        전월대비: <span className="font-bold">{isPositive ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(change)}</span> 원
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-500">
            {/* Top Header & Year Selector - Sticky */}
            <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 -mx-4 px-4 border-b mb-4 transition-all">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">연간 자산 대시보드</h1>
                        <p className="text-muted-foreground mt-1">1년간의 자산 성과를 한눈에 확인하세요.</p>
                    </div>
                    <Card className="bg-background/50 border-border/60 shadow-sm">
                        <div className="px-4 py-2">
                            <YearSelector currentYear={year} />
                        </div>
                    </Card>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-none bg-primary/5 shadow-none">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">연평균 자산</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold text-primary">{new Intl.NumberFormat('ko-KR').format(yearlyTotalAssets)}</h3>
                            <span className="text-xs text-muted-foreground">원</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-red-500/5 shadow-none">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">연평균 부채</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold text-red-600">{new Intl.NumberFormat('ko-KR').format(yearlyTotalLiabilities)}</h3>
                            <span className="text-xs text-muted-foreground">원</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-900/10">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">연평균 순자산</p>
                            {yearlyNetWorth >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold">{new Intl.NumberFormat('ko-KR').format(yearlyNetWorth)}</h3>
                            <span className="text-xs text-slate-400">원</span>
                        </div>
                        <div className="flex flex-col mt-2">
                            <p className={`text-xs flex items-center gap-1 ${yearChange > 0 ? 'text-emerald-400' : yearChange < 0 ? 'text-red-400' : 'text-slate-400'
                                }`}>
                                {yearChange > 0 ? <TrendingUp className="w-3 h-3" /> : yearChange < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                연간 변화: {yearChange > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(yearChange)} 원
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Chart Section */}
            <Card className="shadow-sm border">
                <CardHeader className="bg-muted/30 py-4 border-b">
                    <CardTitle className="text-lg font-bold">월별 순자산 전월대비 증감</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="month"
                                className="text-xs"
                                tick={{ fill: 'currentColor' }}
                            />
                            <YAxis
                                className="text-xs"
                                tick={{ fill: 'currentColor' }}
                                tickFormatter={(value) => new Intl.NumberFormat('ko-KR', {
                                    notation: 'compact',
                                    compactDisplay: 'short'
                                }).format(value)}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar
                                dataKey="netWorthChange"
                                name="전월대비 증감"
                                radius={[4, 4, 0, 0]}
                            >
                                {monthlyData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.netWorthChange > 0 ? '#10b981' : entry.netWorthChange < 0 ? '#ef4444' : '#94a3b8'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Monthly Details Table */}
            <Card className="shadow-sm border">
                <CardHeader className="bg-muted/30 py-4 border-b">
                    <CardTitle className="text-lg font-bold">월별 상세 내역</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/20 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">월</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">자산</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">부채</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">순자산</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {monthlyData.map((data) => (
                                    <tr key={data.monthNumber} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium">{data.month}</td>
                                        <td className="px-4 py-3 text-sm text-right font-mono">
                                            {new Intl.NumberFormat('ko-KR').format(data.totalAssets)} 원
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono text-red-600">
                                            {new Intl.NumberFormat('ko-KR').format(data.totalLiabilities)} 원
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                                            {new Intl.NumberFormat('ko-KR').format(data.netWorth)} 원
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
