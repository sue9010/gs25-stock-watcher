import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) redirect("/login");

  return {
    supabase,
    ownerId: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : "사용자",
  };
}
