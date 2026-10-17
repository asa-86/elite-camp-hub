import { createFileRoute } from "@tanstack/react-router";
import { guardRole } from "@/lib/auth";
import { TeacherDashboard } from "@/components/role-dashboard";

export const Route = createFileRoute("/teacher/")({
  ssr: false,
  beforeLoad: () => guardRole("teacher"),
  head: () => ({ meta: [{ title: "داشبورد معلم | کمپ نخبگان دانش‌آموزی" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: TeacherDashboard,
});
