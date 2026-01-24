import { NavLink, Form } from "react-router";
import { Wallet, PieChart, Settings, LayoutDashboard, BarChart3, Home, LogOut, LogIn } from "lucide-react";
import { cn } from "~/lib/utils";

const menuItems = [
    { icon: Wallet, label: "가계부", to: "/" },
    { icon: LayoutDashboard, label: "가계부 통계", to: "/ledger-dashboard" },
    { icon: PieChart, label: "자산 현황", to: "/assets" },
    { icon: BarChart3, label: "자산현황 통계", to: "/dashboard" },
    { icon: Settings, label: "설정", to: "/settings" },
];

import type { User } from "@supabase/supabase-js";

export function Sidebar({ user }: { user: User | null }) {
    const userEmail = user?.email || "사용자";
    const userInitial = user?.email ? user.email.substring(0, 1).toUpperCase() : "U";

    return (
        <aside className="w-64 border-r bg-card h-screen flex flex-col sticky top-0">
            <div className="p-6 border-b">
                <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                    <Wallet className="w-6 h-6 text-primary" />
                    <span className="tracking-tight">자산 관리</span>
                </h1>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200 group",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon className={cn(
                                    "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                                )} />
                                <span className="font-medium">{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>
            <div className="p-4 border-t mt-auto space-y-3">
                {user ? (
                    <>
                        <Form method="post" action="/logout">
                            <button
                                type="submit"
                                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group"
                            >
                                <LogOut className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                                <span className="font-medium">로그아웃</span>
                            </button>
                        </Form>
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">{userInitial}</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold truncate leading-none mb-1">
                                    {user.user_metadata?.full_name || user.email?.split('@')[0] || "사용자"}
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <NavLink
                        to="/login"
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200 text-muted-foreground hover:bg-primary/10 hover:text-primary group"
                    >
                        <LogIn className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                        <span className="font-medium">로그인</span>
                    </NavLink>
                )}
            </div>
        </aside>
    );
}
