import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "denboard_admin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "");
  const expected = process.env.ADMIN_PIN || "";

  if (!expected) {
    // No pin set: allow, but caller should show a warning.
    const res = NextResponse.json({ ok: true, warning: "ADMIN_PIN is not set." });
    res.cookies.set(ADMIN_COOKIE_NAME, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
    return res;
  }

  if (!pin || pin !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid PIN." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return res;
}

