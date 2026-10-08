"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { revokeTokenAction } from "@/app/actions/tokens";
import { RelativeTime } from "@/components/relative-time";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface TokenRow {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: string | null; // project name, or null for all projects
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function TokensTable({ tokens }: { tokens: TokenRow[] }) {
  const [target, setTarget] = useState<TokenRow | null>(null);
  const [pending, startTransition] = useTransition();

  if (tokens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tokens yet. Create one to connect an agent.
      </p>
    );
  }
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Token</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((t) => (
            <TableRow key={t.id} className={t.revokedAt ? "opacity-60" : undefined}>
              <TableCell className="font-medium">
                {t.name} {t.revokedAt && <Badge variant="secondary">Revoked</Badge>}
              </TableCell>
              <TableCell className="font-mono text-xs">{t.tokenPrefix}…</TableCell>
              <TableCell>{t.scope ?? "All projects"}</TableCell>
              <TableCell>
                <RelativeTime value={t.createdAt} />
              </TableCell>
              <TableCell>
                <RelativeTime value={t.lastUsedAt} fallback="never" />
              </TableCell>
              <TableCell className="text-right">
                {!t.revokedAt && (
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`Revoke ${t.name}`}
                    onClick={() => setTarget(t)}
                  >
                    Revoke
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {target?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Agents using this token lose access immediately. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                if (!target) return;
                startTransition(async () => {
                  const result = await revokeTokenAction(target.id);
                  if (result.ok) {
                    toast.success("Token revoked");
                    setTarget(null);
                  } else toast.error(result.error.message);
                });
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
