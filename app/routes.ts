import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("dashboard", "routes/dashboard.tsx"),
    route("ledger", "routes/ledger.tsx"),
    route("ledger-dashboard", "routes/ledger-dashboard.tsx"),
    route("assets", "routes/assets.tsx"),
    route("settings", "routes/settings.tsx"),
] satisfies RouteConfig;
