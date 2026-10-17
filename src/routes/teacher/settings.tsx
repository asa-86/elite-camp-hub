import { createFileRoute } from "@tanstack/react-router";
import { UserRound, LayoutDashboard } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { AccountSettings } from "@/components/account-settings";
import { guardRole } from "@/lib/auth";
export const Route = createFileRoute("/teacher/settings")({ ssr: false, beforeLoad: () => guardRole("teacher"), head: () => ({ meta: [{ title: "تنظیمات حساب معلم | کمپ نخبگان" }, { name: "robots", content: "noindex, nofollow" }] }), component: () => <AppShell role="teacher" nav={nav}><Page /></AppShell> });
const nav: NavItem[] = [{ to: "/teacher/", label: "داشبورد من", icon: <LayoutDashboard size={18} /> }, { to: "/teacher/settings", label: "تنظیمات حساب", icon: <UserRound size={18} />, exact: true }];
function Page() { return <div className="space-y-6"><header><h1 className="text-2xl font-black">تنظیمات حساب</h1><p className="mt-2 text-sm text-muted-foreground">امنیت حساب معلم</p></header><AccountSettings /></div>; }
