import { createFileRoute } from "@tanstack/react-router";
import { UserRound, LayoutDashboard } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { AccountSettings } from "@/components/account-settings";
import { guardRole } from "@/lib/auth";
export const Route = createFileRoute("/student/settings")({ ssr: false, beforeLoad: () => guardRole("student"), head: () => ({ meta: [{ title: "تنظیمات حساب دانش‌آموز | آرما" }, { name: "robots", content: "noindex, nofollow" }] }), component: () => <AppShell role="student" nav={nav}><Page /></AppShell> });
const nav: NavItem[] = [{ to: "/student/", label: "داشبورد من", icon: <LayoutDashboard size={18} /> }, { to: "/student/settings", label: "تنظیمات حساب", icon: <UserRound size={18} />, exact: true }];
function Page() { return <div className="space-y-6"><header><h1 className="text-2xl font-black">تنظیمات حساب</h1><p className="mt-2 text-sm text-muted-foreground">امنیت حساب دانش‌آموز</p></header><AccountSettings /></div>; }
