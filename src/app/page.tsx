import { ArrowRight, CircleAlert } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { GithubMark } from "@/components/landing/github-mark";
import { Landing } from "@/components/landing/landing";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/current";
import { safeNextPath } from "@/server/auth/github";

const AUTH_ERRORS: Record<string, string> = {
  not_allowed: "That GitHub account is not allowed to sign in here.",
  state: "The sign-in link expired or was tampered with. Please try again.",
  github: "GitHub didn't complete the sign-in. Please try again.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function SignInButton({ next }: { next?: string }) {
  const href = `/api/auth/github?next=${encodeURIComponent(safeNextPath(next))}`;
  return (
    <Button asChild size="lg" className="h-10 gap-2 px-4">
      {/* A plain link: the route handler redirects to GitHub, so no client-side prefetch. */}
      <a href={href}>
        <GithubMark className="size-4" />
        Sign in with GitHub
      </a>
    </Button>
  );
}

/** Depends on the session and the query, so it streams in behind the static landing page. */
async function Cta({ searchParams }: { searchParams: SearchParams }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) {
    return (
      <Button asChild size="lg" className="group h-10 gap-2 px-4">
        <Link href="/projects">
          Open your projects
          <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </Button>
    );
  }
  return <SignInButton next={first(params.next)} />;
}

async function Notice({ searchParams }: { searchParams: SearchParams }) {
  const code = first((await searchParams).auth_error);
  if (!code) return null;
  const message = AUTH_ERRORS[code] ?? "Sign-in failed.";
  return (
    <p
      role="alert"
      className="flex max-w-xl items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export default function LandingPage({ searchParams }: PageProps<"/">) {
  const cta = (
    <Suspense fallback={<SignInButton />}>
      <Cta searchParams={searchParams} />
    </Suspense>
  );
  return (
    <Landing
      cta={cta}
      notice={
        <Suspense fallback={null}>
          <Notice searchParams={searchParams} />
        </Suspense>
      }
    />
  );
}
