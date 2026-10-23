// Public (browser-safe) configuration. Secrets never belong here — see .env.example.
export const config = {
  supabaseUrl: import.meta.env["VITE_SUPABASE_URL"] as string | undefined,
  supabaseKey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined,
  fileServiceUrl: import.meta.env["VITE_FILE_SERVICE_URL"] as string | undefined,
  fileMaxMb: Number(import.meta.env["VITE_FILE_MAX_MB"] ?? 20),
  siteUrl: (import.meta.env["VITE_SITE_URL"] as string | undefined)?.replace(/\/$/, ""),
  /** "demo" = browser-local mock store. Switch to "supabase" once the backend is connected. */
  dataMode: ((import.meta.env["VITE_DATA_MODE"] as string | undefined) ?? "demo") as "demo" | "supabase",
};
