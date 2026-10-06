"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export async function login(formData: FormData) {
  const credentials = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!credentials.success) {
    redirect("/login?error=invalid_input");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);

  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  const { data, error: claimsError } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;

  if (claimsError || !ownerId) {
    await supabase.auth.signOut();
    redirect("/login?error=session");
  }

  const { error: settingsError } = await supabase
    .from("app_settings")
    .upsert({ owner_id: ownerId }, { onConflict: "owner_id", ignoreDuplicates: true });

  if (settingsError) {
    await supabase.auth.signOut();
    redirect("/login?error=settings");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
