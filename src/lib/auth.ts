import { redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, logout, readSession } from "@/services/api";
import type { Role } from "@/lib/types";

export const HOME_BY_ROLE: Record<Role, "/admin" | "/teacher" | "/student"> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

/** Route guard for role layouts (client-only, ssr:false). UI gate only — data access is enforced in the API/RLS. */
export function guardRole(role: Role) {
  const s = readSession();
  if (!s) throw redirect({ to: "/login" });
  if (s.role !== role) throw redirect({ to: HOME_BY_ROLE[s.role] });
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 60_000 });
}

export function useSignOut() {
  const qc = useQueryClient();
  return async () => {
    await qc.cancelQueries();
    logout();
    qc.clear();
  };
}
