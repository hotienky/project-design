import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });

describe("proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("in GitHub mode, sends signed-out visitors to the landing page (401 for APIs)", () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
    const page = proxy(request("/settings?tab=1"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe("http://localhost:3000/?next=%2Fsettings%3Ftab%3D1");
    expect(proxy(request("/api/projects/p/design")).status).toBe(401);
    expect(proxy(request("/")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("/projects", "pd_session=x")).headers.get("x-middleware-next")).toBe("1");
  });

  it("in local mode, lets everything through", () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    for (const path of ["/projects", "/settings", "/api/projects/p/design"]) {
      expect(proxy(request(path)).headers.get("x-middleware-next")).toBe("1");
    }
  });
});
