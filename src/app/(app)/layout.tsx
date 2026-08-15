import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ensureUserAndOrg } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  try {
    await ensureUserAndOrg({
      userId: user.id,
      email: user.email,
      displayName: user.user_metadata?.full_name,
    });
  } catch {
    /* DB may not be configured yet during first setup */
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav email={user.email} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}
