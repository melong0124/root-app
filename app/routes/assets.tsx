import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useNavigation, useSubmit, useSearchParams } from "react-router";
import { prisma } from "~/db.server";
import { MonthSelector } from "~/components/month-selector";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TrendingUp, TrendingDown, GripHorizontal, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { requireAuth } from "~/lib/session.server";

// --- Types & Enums ---

// Keep in sync with Prisma Enum
enum AssetCategory {
    CASH = "CASH",
    STOCK = "STOCK",
    PENSION = "PENSION",
    REAL_ESTATE = "REAL_ESTATE",
    LOAN = "LOAN",
    ESO = "ESO",
    RENTAL = "RENTAL",
}

const CATEGORY_LABELS: Record<AssetCategory, string> = {
    [AssetCategory.CASH]: "현금",
    [AssetCategory.STOCK]: "주식",
    [AssetCategory.PENSION]: "연금",
    [AssetCategory.REAL_ESTATE]: "부동산",
    [AssetCategory.LOAN]: "대출",
    [AssetCategory.ESO]: "우리사주",
    [AssetCategory.RENTAL]: "대여",
};

// 자산/부채 구분
const LIABILITY_CATEGORIES = [AssetCategory.LOAN];

function isLiability(category: AssetCategory): boolean {
    return LIABILITY_CATEGORIES.includes(category);
}

// --- Loader ---

export async function loader({ request }: LoaderFunctionArgs) {
    console.log('🔍 [Assets Loader] Starting...');

    // 인증 체크
    const session = await requireAuth(request);
    console.log('🔍 [Assets Loader] Auth session:', session ? 'exists' : 'null');

    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    console.log('🔍 [Assets Loader] Date params:', { year, month });

    // First day of the selected month
    const selectedDate = new Date(year, month - 1, 1);

    // Previous month calculation
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevDate = new Date(prevYear, prevMonth - 1, 1);

    console.log('🔍 [Assets Loader] Querying assets...');

    // 모든 자산 조회 (사용자 구분 없이)
    // Note: Fetching all values because nested where clause doesn't work properly in Vercel
    const assets = await prisma.asset.findMany({
        include: {
            values: true,
        },
    });

    console.log('🔍 [Assets Loader] Assets found:', assets.length);

    // 첫 번째 사용자 ID 가져오기
    const firstUser = await prisma.user.findFirst();
    console.log('🔍 [Assets Loader] First user:', firstUser ? firstUser.id : 'NOT FOUND');
    if (!firstUser) throw new Error("No user found in database");

    // Group assets by category
    const assetsByCategory: Record<AssetCategory, Array<any>> = {
        [AssetCategory.CASH]: [],
        [AssetCategory.STOCK]: [],
        [AssetCategory.PENSION]: [],
        [AssetCategory.REAL_ESTATE]: [],
        [AssetCategory.LOAN]: [],
        [AssetCategory.ESO]: [],
        [AssetCategory.RENTAL]: []
    };

    let totalAssets = 0;
    let totalLiabilities = 0;
    let prevTotalAssets = 0;
    let prevTotalLiabilities = 0;

    // Process all assets
    // @ts-ignore
    assets.forEach((asset, index) => {
        if (index === 0) {
            console.log('🔍 [Assets Loader] Sample asset values:', asset.values.map((v: any) => ({
                date: v.date,
                dateTime: v.date.getTime(),
                amount: v.amount?.toNumber()
            })));
            console.log('🔍 [Assets Loader] Looking for dates:', {
                selectedDate: selectedDate,
                selectedDateTime: selectedDate.getTime(),
                prevDate: prevDate,
                prevDateTime: prevDate.getTime()
            });
        }

        // Helper to check if two dates are same year/month/day
        const isSameDay = (d1: Date, d2: Date) =>
            d1.getUTCFullYear() === d2.getUTCFullYear() &&
            d1.getUTCMonth() === d2.getUTCMonth() &&
            d1.getUTCDate() === d2.getUTCDate();

        // Current month value
        const currentValueRecord = asset.values.find((v: any) => isSameDay(new Date(v.date), selectedDate));
        const assetValue = currentValueRecord?.amount?.toNumber() ?? 0;

        // Previous month value
        const prevValueRecord = asset.values.find((v: any) => isSameDay(new Date(v.date), prevDate));
        const prevValue = prevValueRecord?.amount?.toNumber() ?? 0;

        if (index === 0) {
            console.log('🔍 [Assets Loader] First asset values processed:', {
                currentValue: assetValue,
                prevValue: prevValue,
                currentFound: !!currentValueRecord,
                prevFound: !!prevValueRecord
            });
        }

        // Calculate change
        const change = assetValue - prevValue;
        const changePercent = prevValue !== 0 ? ((change / prevValue) * 100) : 0;

        // Categorize
        const category = asset.category as AssetCategory;
        if (assetsByCategory[category]) {
            assetsByCategory[category].push({
                ...asset,
                currentValue: assetValue,
                prevValue,
                change,
                changePercent,
            });
        }

        if (isLiability(category)) {
            totalLiabilities += assetValue;
            prevTotalLiabilities += prevValue;
        } else {
            totalAssets += assetValue;
            prevTotalAssets += prevValue;
        }
    });

    const netWorth = totalAssets - totalLiabilities;
    const prevNetWorth = prevTotalAssets - prevTotalLiabilities;
    const netWorthChange = netWorth - prevNetWorth;

    return {
        assetsByCategory,
        year,
        month,
        totalAssets,
        totalLiabilities,
        netWorth,
        prevTotalAssets,
        prevTotalLiabilities,
        prevNetWorth,
        netWorthChange,
        userId: firstUser.id
    };
}

// --- Action ---

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");
    const userId = formData.get("userId") as string;
    const year = parseInt(formData.get("year") as string);
    const month = parseInt(formData.get("month") as string);

    const targetDate = new Date(year, month - 1, 1);

    if (intent === "update_value") {
        const assetId = formData.get("assetId") as string;
        const amountStr = formData.get("amount") as string;
        const amount = parseFloat(amountStr || "0");

        // @ts-ignore
        await prisma.assetValue.upsert({
            where: {
                assetId_date: {
                    assetId,
                    date: targetDate
                }
            },
            create: {
                assetId,
                date: targetDate,
                amount
            },
            update: {
                amount
            }
        });

        return { success: true };
    }

    return null;
}

// --- Component ---

function AssetAmountInput({
    initialValue,
    isReadOnly,
    onSave
}: {
    initialValue: number;
    isReadOnly: boolean;
    onSave: (val: string) => void;
}) {
    const [raw, setRaw] = useState(initialValue?.toString() || "");

    useEffect(() => {
        setRaw(current => {
            if (parseFloat(current) === initialValue) return current;
            return initialValue?.toString() || ""
        });
    }, [initialValue]);

    const formatDisplay = (str: string) => {
        if (!str) return "";
        if (str === "-") return "-";
        const parts = str.split(".");
        let intPart = parts[0];
        let decPart = parts.length > 1 ? "." + parts[1] : "";

        if (intPart !== "-" && intPart !== "") {
            const num = Number(intPart);
            if (!isNaN(num)) {
                intPart = new Intl.NumberFormat('ko-KR').format(num);
            }
        }
        return intPart + decPart;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const stripped = val.replace(/,/g, "");
        if (/^-?\d*\.?\d*$/.test(stripped)) {
            setRaw(stripped);
        }
    };

    const handleBlur = () => {
        if (!isReadOnly) {
            onSave(raw);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur();
        }
    };

    return (
        <input
            type="text"
            className={`pl-8 pr-3 py-1.5 w-full md:w-40 text-right rounded-md border-transparent transition-all font-mono font-bold ${isReadOnly
                ? 'bg-transparent text-muted-foreground cursor-not-allowed'
                : 'bg-muted/30 focus:bg-background focus:ring-1 focus:ring-primary outline-none'
                }`}
            value={formatDisplay(raw)}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            readOnly={isReadOnly}
            placeholder="0"
        />
    );
}



function AssetCategorySection({
    category,
    assets,
    year,
    month,
    userId
}: {
    category: AssetCategory,
    assets: any[],
    year: number,
    month: number,
    userId: string
}) {
    const isLiabilityCategory = isLiability(category);
    const fetcher = useSubmit(); // using submit for generic actions

    const categoryLabel = CATEGORY_LABELS[category];
    // @ts-ignore
    const categoryTotal = assets.reduce((sum, a) => sum + a.currentValue, 0);
    // @ts-ignore
    const categoryPrevTotal = assets.reduce((sum, a) => sum + a.prevValue, 0);
    const categoryChange = categoryTotal - categoryPrevTotal;
    const categoryChangePercent = categoryPrevTotal !== 0 ? ((categoryChange / categoryPrevTotal) * 100) : 0;

    const handleUpdateValue = (assetId: string, newValue: string) => {
        const fd = new FormData();
        fd.append("intent", "update_value");
        fd.append("userId", userId);
        fd.append("year", year.toString());
        fd.append("month", month.toString());
        fd.append("assetId", assetId);
        fd.append("amount", newValue);

        fetcher(fd, { method: "post", navigate: false }); // navigate false prevents full reload
    };

    return (
        <Card className="shadow-sm border overflow-hidden">
            <CardHeader className="bg-muted/30 py-4 flex flex-row items-center justify-between border-b">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-bold">{categoryLabel}</CardTitle>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${isLiabilityCategory
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                            {isLiabilityCategory ? '부채' : '자산'}
                        </span>
                    </div>
                </div>
                <a href="/settings" className="flex items-center text-xs text-muted-foreground hover:text-primary">
                    <Settings className="w-4 h-4 mr-1" />
                    <span className="hidden md:inline">관리</span>
                </a>
            </CardHeader>
            <div className="bg-muted/10 px-4 py-3 flex flex-col gap-1 text-sm border-b">
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">합계 (Total)</span>
                    <span className="font-bold text-lg">{new Intl.NumberFormat('ko-KR').format(categoryTotal)} <span className="text-xs font-normal text-muted-foreground">원</span></span>
                </div>
                {categoryPrevTotal !== 0 && (
                    <div className="flex items-center justify-end gap-2 text-xs">
                        <span className="text-muted-foreground">
                            (전월: {new Intl.NumberFormat('ko-KR').format(categoryPrevTotal)})
                        </span>
                        <span className={`flex items-center gap-1 font-medium ${categoryChange > 0
                            ? (isLiabilityCategory ? 'text-red-600' : 'text-emerald-600')
                            : categoryChange < 0
                                ? (isLiabilityCategory ? 'text-emerald-600' : 'text-red-600')
                                : 'text-muted-foreground'
                            }`}>
                            {categoryChange > 0 ? <TrendingUp className="w-3 h-3" /> : categoryChange < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                            {categoryChange > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(categoryChange)}
                            <span className="opacity-70">({categoryChangePercent > 0 ? '+' : ''}{categoryChangePercent.toFixed(1)}%)</span>
                        </span>
                    </div>
                )}
            </div>
            <CardContent className="p-0">
                {assets.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                        등록된 자산이 없습니다. <a href="/settings" className="underline hover:text-primary">설정 페이지</a>에서 항목을 추가하세요.
                    </div>
                )}
                <div className="divide-y">
                    {assets.map(asset => (
                        <div key={asset.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 group hover:bg-muted/10 transition-colors gap-3 md:gap-0">
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary shrink-0">
                                    <GripHorizontal className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium truncate">
                                            {asset.name}
                                        </span>
                                    </div>
                                    {asset.prevValue !== 0 && asset.change !== 0 && (
                                        <span className={`text-xs flex items-center gap-1 ${asset.change > 0 ? 'text-emerald-600' : 'text-red-600'
                                            }`}>
                                            {asset.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            {asset.change > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(asset.change)}
                                            {asset.changePercent !== 0 && (
                                                <span className="opacity-70">({asset.changePercent > 0 ? '+' : ''}{asset.changePercent.toFixed(1)}%)</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between w-full md:w-auto gap-4 pl-11 md:pl-0">
                                <div className="relative flex-1 md:flex-none">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">₩</span>
                                    <AssetAmountInput
                                        initialValue={asset.currentValue || 0}
                                        isReadOnly={false}
                                        onSave={(val) => handleUpdateValue(asset.id, val)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export default function AssetsPage() {
    const {
        assetsByCategory,
        year,
        month,
        totalAssets,
        totalLiabilities,
        netWorth,
        prevTotalAssets,
        prevTotalLiabilities,
        prevNetWorth,
        netWorthChange,
        userId
    } = useLoaderData<typeof loader>();

    const currentDate = new Date(year, month - 1);

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-4 animate-in fade-in duration-500">

            {/* Top Header & Month Selector - Sticky */}
            <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 -mx-4 px-4 border-b mb-4 transition-all">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">월별 자산 관리</h1>
                        <p className="text-muted-foreground mt-1">매월 나의 자산 변동 현황을 기록합니다.</p>
                    </div>
                    <Card className="bg-background/50 border-border/60 shadow-sm">
                        <div className="px-4 py-2">
                            <MonthSelector currentDate={currentDate} />
                        </div>
                    </Card>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-none bg-primary/5 shadow-none">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Total Assets</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold text-primary">{new Intl.NumberFormat('ko-KR').format(totalAssets)}</h3>
                            <span className="text-xs text-muted-foreground">원</span>
                        </div>
                        {prevTotalAssets !== 0 && (
                            <div className="flex flex-col mt-2">
                                <p className={`text-xs flex items-center gap-1 ${(totalAssets - prevTotalAssets) > 0 ? 'text-emerald-600' : (totalAssets - prevTotalAssets) < 0 ? 'text-red-600' : 'text-muted-foreground'
                                    }`}>
                                    {(totalAssets - prevTotalAssets) > 0 ? <TrendingUp className="w-3 h-3" /> : (totalAssets - prevTotalAssets) < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                    전월대비 {(totalAssets - prevTotalAssets) > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(totalAssets - prevTotalAssets)}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 ml-4">
                                    (전월: {new Intl.NumberFormat('ko-KR').format(prevTotalAssets)})
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="border-none bg-red-500/5 shadow-none">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">Total Liabilities</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold text-red-600">{new Intl.NumberFormat('ko-KR').format(totalLiabilities)}</h3>
                            <span className="text-xs text-muted-foreground">원</span>
                        </div>
                        {prevTotalLiabilities !== 0 && (
                            <div className="flex flex-col mt-2">
                                <p className={`text-xs flex items-center gap-1 ${(totalLiabilities - prevTotalLiabilities) > 0 ? 'text-red-600' : (totalLiabilities - prevTotalLiabilities) < 0 ? 'text-emerald-600' : 'text-muted-foreground'
                                    }`}>
                                    {(totalLiabilities - prevTotalLiabilities) > 0 ? <TrendingUp className="w-3 h-3" /> : (totalLiabilities - prevTotalLiabilities) < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                    전월대비 {(totalLiabilities - prevTotalLiabilities) > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(totalLiabilities - prevTotalLiabilities)}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 ml-4">
                                    (전월: {new Intl.NumberFormat('ko-KR').format(prevTotalLiabilities)})
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-900/10">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Net Worth</p>
                            {netWorth >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold">{new Intl.NumberFormat('ko-KR').format(netWorth)}</h3>
                            <span className="text-xs text-slate-400">원</span>
                        </div>
                        {prevNetWorth !== 0 && (
                            <div className="flex flex-col mt-2">
                                <p className={`text-xs flex items-center gap-1 ${netWorthChange > 0 ? 'text-emerald-400' : netWorthChange < 0 ? 'text-red-400' : 'text-slate-400'
                                    }`}>
                                    {netWorthChange > 0 ? <TrendingUp className="w-3 h-3" /> : netWorthChange < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                    전월대비 {netWorthChange > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(netWorthChange)}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5 ml-4">
                                    (전월: {new Intl.NumberFormat('ko-KR').format(prevNetWorth)})
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Main Content: Asset Categories */}
            <div className="grid gap-4">
                {/* Order of categories as per typical balance sheet: Liquid -> Fixed */}
                <AssetCategorySection category={AssetCategory.CASH} assets={assetsByCategory[AssetCategory.CASH]} year={year} month={month} userId={userId} />
                <AssetCategorySection category={AssetCategory.STOCK} assets={assetsByCategory[AssetCategory.STOCK]} year={year} month={month} userId={userId} />
                <AssetCategorySection category={AssetCategory.PENSION} assets={assetsByCategory[AssetCategory.PENSION]} year={year} month={month} userId={userId} />
                <AssetCategorySection category={AssetCategory.ESO} assets={assetsByCategory[AssetCategory.ESO]} year={year} month={month} userId={userId} />
                <AssetCategorySection category={AssetCategory.REAL_ESTATE} assets={assetsByCategory[AssetCategory.REAL_ESTATE]} year={year} month={month} userId={userId} />
                <AssetCategorySection category={AssetCategory.RENTAL} assets={assetsByCategory[AssetCategory.RENTAL]} year={year} month={month} userId={userId} />

                {/* Liabilities Section */}
                <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Liabilities (부채)</span></div>
                </div>

                <AssetCategorySection category={AssetCategory.LOAN} assets={assetsByCategory[AssetCategory.LOAN]} year={year} month={month} userId={userId} />
            </div>

        </div>
    );
}
