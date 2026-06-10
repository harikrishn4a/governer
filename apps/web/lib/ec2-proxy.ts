import { NextResponse } from "next/server";

const EC2_WEB = process.env.EC2_WEB_URL ?? "http://44.248.228.50:3000";

/** Only Vercel (no DATABASE_URL) should proxy to EC2 — not the EC2 host itself. */
export function shouldProxyToEc2(): boolean {
  return process.env.VERCEL === "1" && !process.env.DATABASE_URL;
}

export async function proxyToEc2(req: Request, path: string): Promise<NextResponse> {
  const url = `${EC2_WEB}${path}${new URL(req.url).search}`;
  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    // Preserve multipart uploads (business file onboarding).
    if (contentType?.includes("multipart/form-data")) {
      init.body = await req.arrayBuffer();
    } else {
      init.body = await req.text();
    }
  }

  const upstream = await fetch(url, init);
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
