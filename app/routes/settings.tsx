import { Form, useActionData, useLoaderData, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Settings as SettingsIcon, Plus, Edit2, Trash2, Save, X, Loader2, CheckCircle2, AlertCircle, Wallet, Landmark, Building, Coins, Banknote, Briefcase, Key } from "lucide-react";
import { prisma } from "~/db.server";
import { useState } from "react";
// Keep in sync with Prisma Enum to avoid ESM import issues on Vercel
enum AssetCategory {
    CASH = "CASH",
    STOCK = "STOCK",
    PENSION = "PENSION",
    REAL_ESTATE = "REAL_ESTATE",
    LOAN = "LOAN",
    ESO = "ESO",
    RENTAL = "RENTAL",
}
import { requireAuth } from "~/lib/session.server";

// --- Constants ---
const CATEGORY_LABELS: Record<AssetCategory, string> = {
    [AssetCategory.CASH]: "현금",
    [AssetCategory.STOCK]: "주식",
    [AssetCategory.PENSION]: "연금",
    [AssetCategory.REAL_ESTATE]: "부동산",
    [AssetCategory.LOAN]: "대출",
    [AssetCategory.ESO]: "우리사주",
    [AssetCategory.RENTAL]: "대여",
};

const CATEGORY_ICONS: Record<AssetCategory, any> = {
    [AssetCategory.CASH]: Banknote,
    [AssetCategory.STOCK]: Landmark,
    [AssetCategory.PENSION]: Coins,
    [AssetCategory.REAL_ESTATE]: Building,
    [AssetCategory.LOAN]: Wallet, // Using Wallet for Loan/Liability for now
    [AssetCategory.ESO]: Briefcase,
    [AssetCategory.RENTAL]: Key,
};

// --- Loader ---
export async function loader({ request }: Route.LoaderArgs) {
    // 인증 체크
    await requireAuth(request);

    // 모든 계정 조회
    const accounts = await prisma.account.findMany({
        include: {
            _count: {
                select: { entries: true }
            }
        },
        orderBy: { name: 'asc' }
    });

    // 모든 자산 항목 조회
    const assets = await prisma.asset.findMany({
        orderBy: { name: 'asc' }
    });

    // 첫 번째 사용자 ID 가져오기 (데이터 생성용)
    const firstUser = await prisma.user.findFirst();
    if (!firstUser) throw new Error("No user found in database");

    const assetAccounts = accounts
        .filter((a) => a.type === "ASSET" || a.type === "LIABILITY")
        .map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            usageCount: a._count.entries
        }));

    const expenseAccounts = accounts
        .filter((a) => a.type === "EXPENSE")
        .map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            usageCount: a._count.entries
        }));

    const revenueAccounts = accounts
        .filter((a) => a.type === "REVENUE")
        .map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            usageCount: a._count.entries
        }));

    // Group assets by category
    const assetsByCategory: Record<string, any[]> = {};
    Object.values(AssetCategory).forEach(cat => {
        assetsByCategory[cat] = assets.filter(a => a.category === cat);
    });

    return {
        assetAccounts,
        expenseAccounts,
        revenueAccounts,
        assetsByCategory,
        userId: firstUser.id
    };
}

// --- Action ---
export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");
    const userId = formData.get("userId") as string;

    try {
        // --- Account Actions ---
        if (intent === "create_account") {
            const name = formData.get("name") as string;
            const type = formData.get("type") as string;

            if (!name || !type) return { error: "계정 이름과 타입을 입력해주세요." };

            await prisma.account.create({
                data: { name, type, userId }
            });
            return { success: `${type === "EXPENSE" ? "지출" : "수입"} 카테고리가 추가되었습니다.` };
        }

        if (intent === "update_account") {
            const accountId = formData.get("accountId") as string;
            const name = formData.get("name") as string;

            if (!name) return { error: "계정 이름을 입력해주세요." };

            await prisma.account.update({
                where: { id: accountId },
                data: { name }
            });
            return { success: "카테고리 이름이 수정되었습니다." };
        }

        if (intent === "delete_account") {
            const accountId = formData.get("accountId") as string;
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                include: { _count: { select: { entries: true } } }
            });

            if (account && account._count.entries > 0) {
                return { error: `이 카테고리는 ${account._count.entries}개의 거래에서 사용 중이므로 삭제할 수 없습니다.` };
            }

            await prisma.account.delete({ where: { id: accountId } });
            return { success: "카테고리가 삭제되었습니다." };
        }

        // --- Asset Actions ---
        if (intent === "create_asset") {
            const name = formData.get("name") as string;
            const category = formData.get("category") as string;

            if (!name || !category) return { error: "자산 이름과 카테고리를 입력해주세요." };

            await prisma.asset.create({
                data: {
                    name,
                    category: category as AssetCategory,
                    userId,
                }
            });
            return { success: "새로운 자산 항목이 추가되었습니다." };
        }

        if (intent === "update_asset_name") {
            const assetId = formData.get("assetId") as string;
            const name = formData.get("name") as string;

            if (!name || !name.trim()) return { error: "자산 이름을 입력해주세요." };

            await prisma.asset.update({
                where: { id: assetId },
                data: { name: name.trim() }
            });
            return { success: "자산 이름이 수정되었습니다." };
        }

        if (intent === "delete_asset") {
            const assetId = formData.get("assetId") as string;
            // Note: Cascade delete is set in schema for AssetValue, so we don't need to check for values manually usually,
            // but if we want to be safe or warn the user, we could check.
            // For now, allow delete as requested in requirements (settings page handles deletion).
            await prisma.asset.delete({
                where: { id: assetId }
            });
            return { success: "자산 항목이 삭제되었습니다." };
        }

        return null;
    } catch (e) {
        console.error(e);
        return { error: "작업 중 오류가 발생했습니다." };
    }
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "설정 - Asset Management" },
        { name: "description", content: "지출/수입 카테고리 및 자산 항목을 관리합니다." },
    ];
}

type Account = {
    id: string;
    name: string;
    type: string;
    usageCount: number;
};

// --- Components ---

function EditableItemCard({
    id,
    name,
    subLabel,
    onEdit,
    onDelete,
    isDeleting,
    canDelete = true,
    borderColorClass = "border-l-gray-500"
}: {
    id: string;
    name: string;
    subLabel?: React.ReactNode;
    onEdit: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    isDeleting: boolean;
    canDelete?: boolean;
    borderColorClass?: string;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(name);

    const handleSave = () => {
        if (editName.trim()) {
            onEdit(id, editName);
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setEditName(name);
        setIsEditing(false);
    };

    return (
        <Card className={`border-l-4 ${borderColorClass} hover:shadow-md transition-shadow`}>
            <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                    {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                            <Input
                                value={editName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                                className="flex-1"
                                autoFocus
                                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === "Enter") handleSave();
                                    if (e.key === "Escape") handleCancel();
                                }}
                            />
                            <Button size="sm" variant="ghost" onClick={handleSave} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                                <Save className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 flex items-center gap-2">
                                <span className="font-medium">{name}</span>
                                {subLabel}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} className="text-muted-foreground hover:text-primary">
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onDelete(id)}
                                    disabled={!canDelete || isDeleting}
                                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                                >
                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function Settings() {
    const { assetAccounts, expenseAccounts, revenueAccounts, assetsByCategory, userId } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const [searchParams, setSearchParams] = useSearchParams();

    // Form states
    const [showAssetAccountForm, setShowAssetAccountForm] = useState(false);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [showRevenueForm, setShowRevenueForm] = useState(false);

    // New item inputs
    const [newAssetAccountName, setNewAssetAccountName] = useState("");
    const [newExpenseName, setNewExpenseName] = useState("");
    const [newRevenueName, setNewRevenueName] = useState("");

    // Asset Management State
    // Derived from search params
    const currentTab = searchParams.get("tab") || "categories";
    const activeAssetTab = searchParams.get("assetTab") || AssetCategory.CASH;

    const [newAssetName, setNewAssetName] = useState("");
    const [addingAssetCategory, setAddingAssetCategory] = useState<string | null>(null);

    // --- Handlers ---
    const submitForm = (formData: FormData) => {
        const form = document.createElement("form");
        form.method = "post";

        for (const [key, value] of formData.entries()) {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = value as string;
            form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    };

    // Account Handlers
    const handleEditAccount = (accountId: string, name: string) => {
        const fd = new FormData();
        fd.append("intent", "update_account");
        fd.append("userId", userId);
        fd.append("accountId", accountId);
        fd.append("name", name);
        submitForm(fd);
    };

    const handleDeleteAccount = (accountId: string) => {
        if (confirm("정말 이 카테고리를 삭제하시겠습니까?")) {
            const fd = new FormData();
            fd.append("intent", "delete_account");
            fd.append("userId", userId);
            fd.append("accountId", accountId);
            submitForm(fd);
        }
    };

    // Asset Handlers
    const handleCreateAsset = (category: string) => {
        if (!newAssetName.trim()) return;
        const fd = new FormData();
        fd.append("intent", "create_asset");
        fd.append("userId", userId);
        fd.append("category", category);
        fd.append("name", newAssetName);
        submitForm(fd);
        setNewAssetName("");
        setAddingAssetCategory(null);
    };

    const handleEditAsset = (assetId: string, name: string) => {
        const fd = new FormData();
        fd.append("intent", "update_asset_name");
        fd.append("userId", userId);
        fd.append("assetId", assetId);
        fd.append("name", name);
        submitForm(fd);
    };

    const handleDeleteAsset = (assetId: string) => {
        if (confirm("정말 이 자산 항목을 삭제하시겠습니까? 기록된 모든 월별 가치 데이터도 함께 삭제됩니다.")) {
            const fd = new FormData();
            fd.append("intent", "delete_asset");
            fd.append("userId", userId);
            fd.append("assetId", assetId);
            submitForm(fd);
        }
    };

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 md:pb-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <SettingsIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-primary">환경 설정</h2>
                    <p className="text-muted-foreground text-sm">카테고리 및 자산 항목을 관리합니다.</p>
                </div>
            </div>

            {/* Feedback Messages */}
            {actionData?.success && (
                <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">{actionData.success}</span>
                </div>
            )}
            {actionData?.error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">{actionData.error}</span>
                </div>
            )}

            <Tabs
                value={currentTab}
                onValueChange={(val) => setSearchParams((prev: URLSearchParams) => {
                    prev.set("tab", val);
                    return prev;
                }, { preventScrollReset: true })}
                className="space-y-6"
            >
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="categories">가계부 카테고리</TabsTrigger>
                    <TabsTrigger value="assets">자산 항목 관리</TabsTrigger>
                </TabsList>

                {/* --- Tab: Categories (Ledger) --- */}
                <TabsContent value="categories" className="space-y-6">
                    {/* Expense Categories */}
                    <Card className="shadow-sm">
                        <CardHeader className="border-b bg-red-50/50 p-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    지출 카테고리
                                </CardTitle>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowExpenseForm(!showExpenseForm)}
                                    className="border-red-200 text-red-600 hover:bg-red-50"
                                >
                                    <Plus className="w-4 h-4 md:mr-1" />
                                    <span className="hidden md:inline">추가</span>
                                </Button>
                            </div>
                            <CardDescription>식비, 교통비 등 지출 항목을 분류합니다.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {showExpenseForm && (
                                <Form method="post" onSubmit={() => setNewExpenseName("")}>
                                    <input type="hidden" name="intent" value="create_account" />
                                    <input type="hidden" name="userId" value={userId} />
                                    <input type="hidden" name="type" value="EXPENSE" />
                                    <div className="flex flex-col md:flex-row gap-2 p-4 bg-muted/30 rounded-lg border-2 border-dashed">
                                        <Input
                                            name="name"
                                            placeholder="새 지출 카테고리 이름"
                                            value={newExpenseName}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewExpenseName(e.target.value)}
                                            required
                                            className="flex-1"
                                            autoFocus
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
                                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            </Button>
                                            <Button type="button" variant="ghost" onClick={() => { setShowExpenseForm(false); setNewExpenseName(""); }}>
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Form>
                            )}

                            {expenseAccounts.length === 0 ? <p className="text-center text-muted-foreground py-8">등록된 지출 카테고리가 없습니다.</p> : (
                                <div className="grid gap-3">
                                    {expenseAccounts.map((account) => (
                                        <EditableItemCard
                                            key={account.id}
                                            id={account.id}
                                            name={account.name}
                                            subLabel={account.usageCount > 0 && <Badge variant="secondary" className="text-xs">{account.usageCount}회 사용 중</Badge>}
                                            onEdit={handleEditAccount}
                                            onDelete={handleDeleteAccount}
                                            isDeleting={isSubmitting}
                                            canDelete={account.usageCount === 0}
                                            borderColorClass="border-l-red-500"
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Revenue Categories */}
                    <Card className="shadow-sm">
                        <CardHeader className="border-b bg-blue-50/50 p-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-bold text-blue-600 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    수입 카테고리
                                </CardTitle>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowRevenueForm(!showRevenueForm)}
                                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                                >
                                    <Plus className="w-4 h-4 md:mr-1" />
                                    <span className="hidden md:inline">추가</span>
                                </Button>
                            </div>
                            <CardDescription>월급, 이자, 배당금 등 수입 항목을 분류합니다.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {showRevenueForm && (
                                <Form method="post" onSubmit={() => setNewRevenueName("")}>
                                    <input type="hidden" name="intent" value="create_account" />
                                    <input type="hidden" name="userId" value={userId} />
                                    <input type="hidden" name="type" value="REVENUE" />
                                    <div className="flex flex-col md:flex-row gap-2 p-4 bg-muted/30 rounded-lg border-2 border-dashed">
                                        <Input
                                            name="name"
                                            placeholder="새 수입 카테고리 이름"
                                            value={newRevenueName}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRevenueName(e.target.value)}
                                            required
                                            className="flex-1"
                                            autoFocus
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            </Button>
                                            <Button type="button" variant="ghost" onClick={() => { setShowRevenueForm(false); setNewRevenueName(""); }}>
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Form>
                            )}

                            {revenueAccounts.length === 0 ? <p className="text-center text-muted-foreground py-8">등록된 수입 카테고리가 없습니다.</p> : (
                                <div className="grid gap-3">
                                    {revenueAccounts.map((account) => (
                                        <EditableItemCard
                                            key={account.id}
                                            id={account.id}
                                            name={account.name}
                                            subLabel={account.usageCount > 0 && <Badge variant="secondary" className="text-xs">{account.usageCount}회 사용 중</Badge>}
                                            onEdit={handleEditAccount}
                                            onDelete={handleDeleteAccount}
                                            isDeleting={isSubmitting}
                                            canDelete={account.usageCount === 0}
                                            borderColorClass="border-l-blue-500"
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Ledger Asset Accounts (Sources) */}
                    <Card className="shadow-sm">
                        <CardHeader className="border-b bg-green-50/50 p-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-bold text-green-600 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    거래 출처 (계좌/카드)
                                </CardTitle>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowAssetAccountForm(!showAssetAccountForm)}
                                    className="border-green-200 text-green-600 hover:bg-green-50"
                                >
                                    <Plus className="w-4 h-4 md:mr-1" />
                                    <span className="hidden md:inline">추가</span>
                                </Button>
                            </div>
                            <CardDescription>가계부 거래 입력 시 사용되는 출처(지갑, 은행계좌)입니다.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {showAssetAccountForm && (
                                <Form method="post" onSubmit={() => setNewAssetAccountName("")}>
                                    <input type="hidden" name="intent" value="create_account" />
                                    <input type="hidden" name="userId" value={userId} />
                                    <input type="hidden" name="type" value="ASSET" />
                                    <div className="flex flex-col md:flex-row gap-2 p-4 bg-muted/30 rounded-lg border-2 border-dashed">
                                        <Input
                                            name="name"
                                            placeholder="새 출처 이름 (예: 신한은행, 현금)"
                                            value={newAssetAccountName}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAssetAccountName(e.target.value)}
                                            required
                                            className="flex-1"
                                            autoFocus
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            </Button>
                                            <Button type="button" variant="ghost" onClick={() => { setShowAssetAccountForm(false); setNewAssetAccountName(""); }}>
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Form>
                            )}

                            {assetAccounts.length === 0 ? <p className="text-center text-muted-foreground py-8">등록된 출처가 없습니다.</p> : (
                                <div className="grid gap-3">
                                    {assetAccounts.map((account) => (
                                        <EditableItemCard
                                            key={account.id}
                                            id={account.id}
                                            name={account.name}
                                            subLabel={account.usageCount > 0 && <Badge variant="secondary" className="text-xs">{account.usageCount}회 사용 중</Badge>}
                                            onEdit={handleEditAccount}
                                            onDelete={handleDeleteAccount}
                                            isDeleting={isSubmitting}
                                            canDelete={account.usageCount === 0}
                                            borderColorClass="border-l-green-500"
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>


                {/* --- Tab: Assets (Detailed Management) --- */}
                <TabsContent value="assets" className="space-y-6">
                    <Card className="border-none bg-muted/30 shadow-none mb-6">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <AlertCircle className="w-5 h-5 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">자산 항목 관리 안내</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        매월 자산 가치를 기록할 대상 항목들을 관리합니다.<br />
                                        여기서 항목을 추가/삭제/수정하면 '자산 관리' 페이지에 반영됩니다.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Tabs
                        value={activeAssetTab}
                        onValueChange={(val) => setSearchParams((prev: URLSearchParams) => {
                            prev.set("assetTab", val);
                            return prev;
                        }, { preventScrollReset: true })}
                        className="w-full"
                    >
                        <div className="overflow-x-auto pb-2">
                            <TabsList>
                                {Object.values(AssetCategory).map((category) => {
                                    const Icon = CATEGORY_ICONS[category];
                                    return (
                                        <TabsTrigger key={category} value={category} className="gap-2">
                                            {Icon && <Icon className="w-4 h-4" />}
                                            {CATEGORY_LABELS[category]}
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>
                        </div>

                        {Object.values(AssetCategory).map((category) => {
                            const assets = assetsByCategory[category] || [];
                            const isAdding = addingAssetCategory === category;

                            return (
                                <TabsContent key={category} value={category} className="mt-4">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between border-b p-4">
                                            <div>
                                                <CardTitle className="text-lg">{CATEGORY_LABELS[category]} 항목 목록</CardTitle>
                                                <CardDescription className="mt-1">
                                                    총 {assets.length}개의 {CATEGORY_LABELS[category]} 항목이 있습니다.
                                                </CardDescription>
                                            </div>
                                            <Button
                                                onClick={() => setAddingAssetCategory(category)}
                                                disabled={isAdding}
                                                size="sm"
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                항목 추가
                                            </Button>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-3">
                                            {isAdding && (
                                                <div className="flex flex-col md:flex-row gap-2 p-4 bg-muted/30 rounded-lg border-2 border-dashed mb-4 animate-in slide-in-from-top-2">
                                                    <Input
                                                        placeholder={`새 ${CATEGORY_LABELS[category]} 이름 (예: OOOO)`}
                                                        value={newAssetName}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAssetName(e.target.value)}
                                                        className="flex-1"
                                                        autoFocus
                                                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                                            if (e.key === "Enter") handleCreateAsset(category);
                                                            if (e.key === "Escape") {
                                                                setAddingAssetCategory(null);
                                                                setNewAssetName("");
                                                            }
                                                        }}
                                                    />
                                                    <div className="flex gap-2 justify-end">
                                                        <Button onClick={() => handleCreateAsset(category)} disabled={isSubmitting}>
                                                            <Save className="w-4 h-4 mr-2" /> 저장
                                                        </Button>
                                                        <Button variant="ghost" onClick={() => { setAddingAssetCategory(null); setNewAssetName(""); }}>
                                                            <X className="w-4 h-4 mr-2" /> 취소
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {assets.length === 0 && !isAdding ? (
                                                <p className="text-center text-muted-foreground py-12">
                                                    등록된 {CATEGORY_LABELS[category]} 항목이 없습니다.
                                                </p>
                                            ) : (
                                                <div className="grid gap-3">
                                                    {assets.map((asset) => (
                                                        <EditableItemCard
                                                            key={asset.id}
                                                            id={asset.id}
                                                            name={asset.name}
                                                            onEdit={handleEditAsset}
                                                            onDelete={handleDeleteAsset}
                                                            isDeleting={isSubmitting}
                                                            borderColorClass="border-l-primary"
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div>
    );
}
