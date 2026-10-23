import { createFileRoute } from "@tanstack/react-router";
import { guardRole } from "@/lib/auth";
import { AdminDashboard } from "@/components/role-dashboard";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  beforeLoad: () => guardRole("admin"),
  head: () => ({ meta: [{ title: "داشبورد مدیر | آرما" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminDashboard,
});
