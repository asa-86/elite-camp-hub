import { createFileRoute } from "@tanstack/react-router";
import { UserRound, LayoutDashboard } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { AccountSettings } from "@/components/account-settings";
import { guardRole } from "@/lib/auth";
export const Route = createFileRoute("/admin/settings")({ ssr: false, beforeLoad: () => guardRole("admin"), head: () => ({ meta: [{ title: "تنظیمات حساب مدیر | آرما" }, { name: "robots", content: "noindex, nofollow" }] }), component: () => <AppShell role="admin" nav={nav}><Page /></AppShell> });
const nav: NavItem[] = [{ to: "/admin/", label: "نمای کلی", icon: <LayoutDashboard size={18} /> }, { to: "/admin/settings", label: "تنظیمات حساب", icon: <UserRound size={18} />, exact: true }];
function Page() { return <div className="space-y-6"><header><h1 className="text-2xl font-black">تنظیمات حساب</h1><p className="mt-2 text-sm text-muted-foreground">امنیت حساب مدیر</p></header><AccountSettings /></div>; }
