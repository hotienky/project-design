import { AccountNav } from "@/components/app-shell/top-bar";
import { getCurrentUser } from "@/server/auth/current";

/** The top bar's session-dependent part. Render it inside <Suspense>. */
export async function Account() {
  const user = await getCurrentUser();
  return (
    <AccountNav user={user && { login: user.login, name: user.name, avatarUrl: user.avatarUrl }} />
  );
}
