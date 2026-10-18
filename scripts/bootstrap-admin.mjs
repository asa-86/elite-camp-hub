import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
const env = Object.fromEntries(envText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => { const i = line.indexOf("="); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const base = env.VITE_SUPABASE_URL;
const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!base || !publicKey) throw new Error("آدرس Supabase و کلید عمومی را در فایل .env تنظیم کنید.");
if (!stdin.isTTY || typeof stdin.setRawMode !== "function") throw new Error("این دستور را در ترمینال تعاملی اجرا کنید.");

const visible = async (prompt) => {
  const rl = createInterface({ input: stdin, output: stdout });
  try { return await rl.question(prompt); } finally { rl.close(); }
};

function hidden(prompt) {
  stdout.write(prompt);
  stdin.setRawMode(true); stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk) => {
      const c = chunk.toString("utf8");
      if (c === "\u0003") { cleanup(); stdout.write("\n"); reject(new Error("لغو شد.")); }
      else if (c === "\r" || c === "\n") { cleanup(); stdout.write("\n"); resolve(value); }
      else if (c === "\u007f" || c === "\b") { value = value.slice(0, -1); stdout.write("\b \b"); }
      else if (c >= " ") { value += c; stdout.write("*"); }
    };
    const cleanup = () => { stdin.off("data", onData); stdin.setRawMode(false); };
    stdin.on("data", onData);
  });
}

try {
  const bootstrapToken = await hidden("توکن راه‌اندازی (ورودی مخفی): ");
  const username = (await visible("نام کاربری مدیر: ")).trim().toLowerCase();
  const fullName = (await visible("نام و نام خانوادگی مدیر: ")).trim();
  const password = await hidden("گذرواژهٔ مدیر (حداقل ۸ نویسه، شامل حرف و عدد): ");
  const confirm = await hidden("تکرار گذرواژه: ");
  if (password !== confirm) throw new Error("گذرواژه‌ها یکسان نیستند.");
  const response = await fetch(`${base}/functions/v1/provision-user`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: publicKey },
    body: JSON.stringify({ bootstrapToken, username, fullName, role: "admin", password, active: true }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? `درخواست ناموفق بود (${response.status}).`);
  stdout.write(`حساب مدیر ساخته شد: ${result.profile?.username ?? username}\n`);
  stdout.write("توکن راه‌اندازی را از Edge Function Secrets حذف کن و سپس با این حساب وارد شو.\n");
} finally {
  if (stdin.isTTY && stdin.isRaw) stdin.setRawMode(false);
}
