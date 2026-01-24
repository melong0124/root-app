import { NavLink } from "react-router";
import { Wallet, PieChart, Settings, LayoutDashboard, BarChart3, Home } from "lucide-react";
import { cn } from "~/lib/utils";

const menuItems = [
    { icon: Home, label: "홈", to: "/" },
    { icon: BarChart3, label: "대시보드", to: "/dashboard" },
    { icon: Wallet, label: "가계부", to: "/ledger" },
    { icon: LayoutDashboard, label: "가계부 통계", to: "/ledger-dashboard" },
    { icon: PieChart, label: "자산 현황", to: "/assets" },
    { icon: Settings, label: "설정", to: "/settings" },
];

export function Sidebar() {
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
            <div className="p-6 border-t mt-auto">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">SC</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold truncate leading-none mb-1">사용자</span>
                        <span className="text-[10px] text-muted-foreground truncate">Free Plan</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
