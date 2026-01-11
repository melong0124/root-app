import { NavLink } from "react-router";
import { Wallet, PieChart, Settings, Home, BarChart3 } from "lucide-react";
import { cn } from "~/lib/utils";

const menuItems = [
    { icon: Home, label: "홈", to: "/" },
    { icon: BarChart3, label: "대시보드", to: "/dashboard" },
    { icon: Wallet, label: "가계부", to: "/ledger" },
    { icon: PieChart, label: "자산", to: "/assets" },
    { icon: Settings, label: "설정", to: "/settings" },
];

export function MobileNav() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 border-t bg-background flex justify-around items-center h-16 px-2 z-50 md:hidden pb-safe">
            {menuItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                        cn(
                            "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                            isActive
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )
                    }
                >
                    {({ isActive }) => (
                        <>
                            <item.icon className={cn("w-5 h-5", isActive && "fill-current")} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </>
                    )}
                </NavLink>
            ))}
        </nav>
    );
}
