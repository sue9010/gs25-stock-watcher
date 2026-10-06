import { redirect } from "next/navigation";

import { login } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/server";

const errorMessages: Record<string, string> = {
  invalid_input: "이메일 형식과 8자 이상의 비밀번호를 확인해주세요.",
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  session: "로그인 세션을 확인하지 못했습니다. 다시 시도해주세요.",
  settings: "사용자 설정을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const [{ data }, params] = await Promise.all([supabase.auth.getClaims(), searchParams]);

  if (data?.claims) {
    redirect("/");
  }

  const message = params.error ? errorMessages[params.error] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-400 text-sm font-black text-slate-950">
            25
          </span>
          <div>
            <h1 className="font-semibold text-white">GS25 Stock Watcher</h1>
            <p className="text-xs text-slate-500">초대된 사용자 전용 관리 도구</p>
          </div>
        </div>

        <form action={login} className="mt-8 space-y-4">
          <label className="block text-sm text-slate-300">
            이메일
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none transition focus:border-emerald-400"
            />
          </label>
          <label className="block text-sm text-slate-300">
            비밀번호
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              maxLength={128}
              required
              className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none transition focus:border-emerald-400"
            />
          </label>

          {message ? (
            <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            className="h-11 w-full rounded-lg bg-emerald-400 font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            로그인
          </button>
        </form>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          회원가입 기능은 제공하지 않습니다. Supabase에서 초대되거나 생성된 사용자만 로그인할 수 있습니다.
        </p>
      </section>
    </main>
  );
}
