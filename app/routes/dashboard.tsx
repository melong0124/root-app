import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { prisma } from "~/db.server";
import { YearSelector } from "~/components/year-selector";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList } from "recharts";
import { requireAuth } from "~/lib/session.server";

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
    // 인증 체크
    await requireAuth(request);

    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();

    // 모든 자산 조회 (사용자 구분 없이)
    const assets = await prisma.asset.findMany({
        include: {
            values: true,
        },
    });

    // 첫 번째 사용자 ID 가져오기
    const firstUser = await prisma.user.findFirst();
    if (!firstUser) throw new Error("No user found in database");

    // Helper to convert date to KST Year-Month string for robust comparison
    const getYM = (d: Date) => {
        return new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric',
            month: 'numeric',
            timeZone: 'Asia/Seoul'
        }).format(new Date(d));
    };

    // Initialize monthly data for the selected year
    const monthlyData: Array<{
        month: string;
        monthNumber: number;
        totalAssets: number;
        totalLiabilities: number;
        netWorth: number;
        netWorthChange: number;
    }> = [];

    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

    // Determine the last month to show for the selected year
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const lastMonthToProcess = (year < currentYear) ? 12 : (year === currentYear) ? currentMonth : 0;

    // Process each month up to the last available month
    for (let month = 1; month <= lastMonthToProcess; month++) {
        const targetDate = new Date(year, month - 1, 1);
        const targetYM = getYM(targetDate);

        let totalAssets = 0;
        let totalLiabilities = 0;

        assets.forEach((asset) => {
            const valueRecord = asset.values.find((v: any) => getYM(v.date) === targetYM);
            const assetValue = valueRecord?.amount?.toNumber() ?? 0;

            const category = asset.category as AssetCategory;
            if (isLiability(category)) {
                totalLiabilities += assetValue;
            } else {
                totalAssets += assetValue;
            }
        });

        monthlyData.push({
            month: monthNames[month - 1],
            monthNumber: month,
            totalAssets,
            totalLiabilities,
            netWorth: totalAssets - totalLiabilities,
            netWorthChange: 0,
        });
    }

    // Handle empty data for future years
    if (monthlyData.length === 0) {
        return {
            year,
            monthlyData: [],
            yearEnd: { totalAssets: 0, totalLiabilities: 0, netWorth: 0 },
            prevYearEnd: { totalAssets: 0, totalLiabilities: 0, netWorth: 0 },
            yoy: { assets: 0, liabilities: 0, netWorth: 0 },
            yearlyHistory: [],
            userId: firstUser.id,
        };
    }

    // Calculate month-over-month changes within the selected year
    for (let i = 0; i < monthlyData.length; i++) {
        if (i > 0) {
            monthlyData[i].netWorthChange = monthlyData[i].netWorth - monthlyData[i - 1].netWorth;
        } else {
            // Compare Jan with previous year's Dec
            const prevDecDate = new Date(year - 1, 11, 1);
            const prevDecYM = getYM(prevDecDate);
            let prevDecNetWorth = 0;
            assets.forEach(asset => {
                const val = asset.values.find((v: any) => getYM(v.date) === prevDecYM);
                const amt = val?.amount?.toNumber() ?? 0;
                if (isLiability(asset.category as AssetCategory)) prevDecNetWorth -= amt;
                else prevDecNetWorth += amt;
            });
            monthlyData[i].netWorthChange = monthlyData[i].netWorth - prevDecNetWorth;
        }
    }

    // Calculate Latest available values for the selected year (Year-to-Date or Year-End)
    const currentYearEnd = monthlyData[monthlyData.length - 1];

    // Calculate Year-End (December) values for the PREVIOUS year
    let prevYearEndAssets = 0;
    let prevYearEndLiabilities = 0;
    const prevDecDate = new Date(year - 1, 11, 1);
    const prevDecYM = getYM(prevDecDate);

    assets.forEach((asset) => {
        const valueRecord = asset.values.find((v: any) => getYM(v.date) === prevDecYM);
        const assetValue = valueRecord?.amount?.toNumber() ?? 0;

        if (isLiability(asset.category as AssetCategory)) {
            prevYearEndLiabilities += assetValue;
        } else {
            prevYearEndAssets += assetValue;
        }
    });

    const prevYearEndNetWorth = prevYearEndAssets - prevYearEndLiabilities;

    // Calculate YoY Changes
    const yoyAssetsChange = currentYearEnd.totalAssets - prevYearEndAssets;
    const yoyLiabilitiesChange = currentYearEnd.totalLiabilities - prevYearEndLiabilities;
    const yoyNetWorthChange = currentYearEnd.netWorth - prevYearEndNetWorth;

    // Gather Yearly History (Latest available of each year)
    const yearsWithData = Array.from(new Set(
        assets.flatMap(a => a.values.map(v => new Date(v.date).getFullYear()))
    )).sort((a, b) => b - a); // Newest first

    const yearlyHistory = (yearsWithData as number[]).map(y => {
        // If it's current year, use current month, else use Dec
        const targetMonth = (y === currentYear) ? currentMonth - 1 : 11;
        const targetDate = new Date(y, targetMonth, 1);
        const targetYM = getYM(targetDate);

        let assetsSum = 0;
        let liabilitiesSum = 0;
        assets.forEach((asset: any) => {
            const val = asset.values.find((v: any) => getYM(v.date) === targetYM);
            const amt = val?.amount?.toNumber() ?? 0;
            if (isLiability(asset.category as AssetCategory)) liabilitiesSum += amt;
            else assetsSum += amt;
        });
        return {
            year: y,
            assets: assetsSum,
            liabilities: liabilitiesSum,
            netWorth: assetsSum - liabilitiesSum,
            label: y === currentYear ? `${y} (현재)` : `${y} (기말)`
        };
    });

    return {
        year,
        monthlyData,
        yearEnd: currentYearEnd,
        prevYearEnd: {
            totalAssets: prevYearEndAssets,
            totalLiabilities: prevYearEndLiabilities,
            netWorth: prevYearEndNetWorth
        },
        yoy: {
            assets: yoyAssetsChange,
            liabilities: yoyLiabilitiesChange,
            netWorth: yoyNetWorthChange
        },
        yearlyHistory,
        userId: firstUser.id,
    };
}

// --- Component ---

export default function DashboardPage() {
    const {
        year,
        monthlyData,
        yearEnd,
        yoy,
        yearlyHistory,
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
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">자산현황 통계</h1>
                        <p className="text-muted-foreground mt-1">연간 자산 변동 및 현황을 한눈에 확인하세요.</p>
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
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">{year}년 기말 자산</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${yoy.assets >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                YoY {yoy.assets >= 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(yoy.assets)}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold text-primary">{new Intl.NumberFormat('ko-KR').format(yearEnd.totalAssets)}</h3>
                            <span className="text-xs text-muted-foreground">원</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-red-500/5 shadow-none">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">{year}년 기말 부채</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${yoy.liabilities <= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                YoY {yoy.liabilities >= 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(yoy.liabilities)}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold text-red-600">{new Intl.NumberFormat('ko-KR').format(yearEnd.totalLiabilities)}</h3>
                            <span className="text-xs text-muted-foreground">원</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-900/10">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{year}년 기말 순자산</p>
                            {yoy.netWorth >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold">{new Intl.NumberFormat('ko-KR').format(yearEnd.netWorth)}</h3>
                            <span className="text-xs text-slate-400">원</span>
                        </div>
                        <div className="flex flex-col mt-2">
                            <p className={`text-xs flex items-center gap-1 ${yoy.netWorth > 0 ? 'text-emerald-400' : yoy.netWorth < 0 ? 'text-red-400' : 'text-slate-400'
                                }`}>
                                {yoy.netWorth > 0 ? <TrendingUp className="w-3 h-3" /> : yoy.netWorth < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                전년대비: {yoy.netWorth > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(yoy.netWorth)} 원
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
                                <LabelList
                                    dataKey="netWorthChange"
                                    position="top"
                                    formatter={(value: any) => {
                                        if (value === undefined || value === null || value === 0) return "";
                                        const numValue = Number(value);
                                        return (numValue > 0 ? "+" : "") + new Intl.NumberFormat('ko-KR', {
                                            notation: 'compact',
                                            compactDisplay: 'short'
                                        }).format(numValue);
                                    }}
                                    style={{ fill: 'currentColor', fontSize: '10px', fontWeight: '600' }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Monthly Details Table */}
            <Card className="shadow-sm border">
                <CardHeader className="bg-muted/30 py-4 border-b">
                    <CardTitle className="text-lg font-bold">{year}년 월별 상세 내역</CardTitle>
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
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider text-emerald-600">전월대비</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {monthlyData.map((data) => (
                                    <tr key={data.monthNumber} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium">{data.month}</td>
                                        <td className="px-4 py-3 text-sm text-right font-mono">
                                            {new Intl.NumberFormat('ko-KR').format(data.totalAssets)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono text-red-600">
                                            {new Intl.NumberFormat('ko-KR').format(data.totalLiabilities)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                                            {new Intl.NumberFormat('ko-KR').format(data.netWorth)}
                                        </td>
                                        <td className={`px-4 py-3 text-sm text-right font-mono font-semibold ${data.netWorthChange > 0 ? 'text-emerald-600' : data.netWorthChange < 0 ? 'text-red-600' : 'text-muted-foreground'
                                            }`}>
                                            {data.netWorthChange > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(data.netWorthChange)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Yearly History Section */}
            <Card className="shadow-sm border">
                <CardHeader className="bg-muted/30 py-4 border-b">
                    <CardTitle className="text-lg font-bold">연도별 기말 성과 (12월 기준)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/20 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">연도</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">기말 자산</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">기말 부채</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">기말 순자산</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">전년대비</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {yearlyHistory.map((h, idx) => {
                                    const prevYearData = yearlyHistory[idx + 1];
                                    const yoyChange = prevYearData ? h.netWorth - prevYearData.netWorth : 0;
                                    return (
                                        <tr key={h.year} className={`hover:bg-muted/10 transition-colors ${h.year === year ? 'bg-primary/5 font-bold' : ''}`}>
                                            <td className="px-4 py-3 text-sm font-medium">{h.label}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono">
                                                {new Intl.NumberFormat('ko-KR').format(h.assets)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-red-600">
                                                {new Intl.NumberFormat('ko-KR').format(h.liabilities)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono">
                                                {new Intl.NumberFormat('ko-KR').format(h.netWorth)}
                                            </td>
                                            <td className={`px-4 py-3 text-sm text-right font-mono ${yoyChange > 0 ? 'text-emerald-600' : yoyChange < 0 ? 'text-red-600' : 'text-muted-foreground'
                                                }`}>
                                                {prevYearData ? (
                                                    <>
                                                        {yoyChange > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(yoyChange)}
                                                    </>
                                                ) : '-'}
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
    );
}
