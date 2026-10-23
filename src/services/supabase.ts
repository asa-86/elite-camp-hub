import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/services/config";
import type { Grade } from "@/lib/types";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error("تنظیمات اتصال Supabase کامل نیستند.");
  }
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export interface ProfileRow {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "teacher" | "student";
  active: boolean;
  grade: Grade | null;
  student_code: string | null;
  created_at: string;
}

export function profileToUser(p: ProfileRow) {
  return {
    id: p.id,
    username: p.username,
    fullName: p.full_name,
    role: p.role,
    active: p.active,
    grade: p.grade ?? undefined,
    studentCode: p.student_code ?? undefined,
    createdAt: p.created_at,
  };
}
