"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createTokenAction } from "@/app/actions/tokens";
import { ConnectSnippets, copyText } from "@/components/settings/connect-snippets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export function CreateTokenDialog({
  projects,
  appUrl,
}: {
  projects: { slug: string; name: string }[];
  appUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState(ALL);
  const [token, setToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setScope(ALL);
      setToken(null);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createTokenAction({
        name,
        projectSlug: scope === ALL ? null : scope,
      });
      if (result.ok) setToken(result.token);
      else toast.error(result.error.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <KeyRound /> Create token
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {token === null ? (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Create MCP token</DialogTitle>
              <DialogDescription>
                A token lets a coding agent read designs over MCP.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="token-name">Name</Label>
              <Input
                id="token-name"
                value={name}
                maxLength={80}
                placeholder="e.g. my-repo agent"
                required
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="token-scope">Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger id="token-scope" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || name.trim() === ""}>
                {pending ? "Creating…" : "Create token"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Token created</DialogTitle>
              <DialogDescription>You won&apos;t see this token again.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input readOnly value={token} aria-label="New token" className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copyText(token, "Token copied")}>
                <Copy /> Copy
              </Button>
            </div>
            <ConnectSnippets appUrl={appUrl} token={token} />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>
                <Check /> Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
