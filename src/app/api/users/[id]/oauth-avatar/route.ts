import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getUserOAuthAvatarUrl } from "@/server/users/profile";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const canViewAnyUser = Boolean(session.user.platformRole);
  const canViewSelf = session.user.id === id;

  if (!canViewSelf && !canViewAnyUser) {
    const publicUser = await prisma.user.findUnique({
      where: { id },
      select: { publicProfileEnabled: true },
    });
    if (!publicUser?.publicProfileEnabled) {
      return new NextResponse(null, { status: 404 });
    }
  }

  const avatarUrl = await getUserOAuthAvatarUrl(id);
  if (!avatarUrl) return new NextResponse(null, { status: 404 });

  const response = await fetch(avatarUrl, {
    headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
