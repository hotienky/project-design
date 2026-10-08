import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-3 p-16 text-center">
      <h1 className="font-heading text-lg font-semibold">Project not found</h1>
      <p className="text-sm text-muted-foreground">It may have been deleted or renamed.</p>
      <Link href="/" className="text-sm underline">
        Back to projects
      </Link>
    </main>
  );
}
