import { createFileRoute } from "@tanstack/react-router";
import { AdminPeoplePage } from "@/components/admin-people";
import { guardRole } from "@/lib/auth";

export const Route = createFileRoute("/admin/teachers")({
  ssr: false,
  beforeLoad: () => guardRole("admin"),
  head: () => ({ meta: [{ title: "مدیریت معلمان | کمپ نخبگان" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: () => <AdminPeoplePage role="teacher" />,
});
