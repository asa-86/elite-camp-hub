import { createFileRoute } from "@tanstack/react-router";
import { guardRole } from "@/lib/auth";
import { StudentDashboard } from "@/components/role-dashboard";

export const Route = createFileRoute("/student/")({
  ssr: false,
  beforeLoad: () => guardRole("student"),
  head: () => ({ meta: [{ title: "داشبورد دانش‌آموز | کمپ نخبگان دانش‌آموزی" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: StudentDashboard,
});
