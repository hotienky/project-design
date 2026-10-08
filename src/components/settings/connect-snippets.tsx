"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export async function copyText(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Couldn't copy. Select the text and copy it manually.");
  }
}

function Snippet({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <Button
          variant="ghost"
          size="xs"
          aria-label={`Copy ${title}`}
          onClick={async () => {
            await copyText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

/** How to point a coding agent at this server. `token` is the placeholder unless one was just created. */
export function ConnectSnippets({ appUrl, token }: { appUrl: string; token?: string }) {
  const url = `${appUrl.replace(/\/$/, "")}/api/mcp`;
  const bearer = token ?? "<token>";
  const mcpJson = JSON.stringify(
    {
      mcpServers: {
        "project-design": {
          type: "http",
          url,
          headers: { Authorization: "Bearer ${PROJECT_DESIGN_TOKEN}" },
        },
      },
    },
    null,
    2,
  );
  return (
    <div className="grid gap-4">
      <Snippet
        title="Claude Code"
        text={`claude mcp add --transport http project-design ${url} --header "Authorization: Bearer ${bearer}"`}
      />
      <Snippet title=".mcp.json (keep the token in an environment variable)" text={mcpJson} />
      <p className="text-sm text-muted-foreground">
        Any other agent: add a Streamable HTTP MCP server at{" "}
        <code className="font-mono text-xs">{url}</code> with the header{" "}
        <code className="font-mono text-xs">Authorization: Bearer {bearer}</code>. Create a
        project-scoped token for each generated repository.
      </p>
    </div>
  );
}
