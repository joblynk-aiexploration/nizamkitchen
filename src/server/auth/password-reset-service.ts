import { UserStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { generateOpaqueToken, hashToken } from "@/lib/security.server";
import { getPublicRequestOrigin } from "@/lib/request-origin";
import { createAuditEvent } from "@/server/audit";
import { sendTemplateEmail } from "@/server/email/email-service";

const RESET_TOKEN_TTL_MINUTES = 45;
const RESET_EMAIL_SENT_MESSAGE = "Password reset email sent. Please check your inbox for the secure reset link.";
const RESET_EMAIL_NOT_FOUND_MESSAGE = "No account exists for that email address. Please check the spelling or create a new account.";
const RESET_INACTIVE_ACCOUNT_MESSAGE = "That account is not active. Please contact support before resetting your password.";

type RequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function requestPasswordReset(email: string, request: Request, metadata: RequestMetadata = {}) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
    },
  });

  if (!user) {
    await createAuditEvent({
      action: "user.password_reset_requested",
      targetType: "user",
      targetId: null,
      details: { emailKnown: false, email: maskEmail(normalizedEmail) },
      ...metadata,
    });
    return { message: RESET_EMAIL_NOT_FOUND_MESSAGE, emailSent: false };
  }

  if (user.status !== UserStatus.active) {
    await createAuditEvent({
      actorUserId: user.id,
      action: "user.password_reset_requested",
      targetType: "user",
      targetId: user.id,
      details: { emailKnown: true, accountActive: false },
      ...metadata,
    });
    return { message: RESET_INACTIVE_ACCOUNT_MESSAGE, emailSent: false };
  }

  const rawToken = generateOpaqueToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null,
    },
  });

  const resetUrl = new URL(`/reset-password?token=${encodeURIComponent(rawToken)}`, getPublicRequestOrigin(request));

  await sendTemplateEmail({
    to: user.email,
    recipientUserId: user.id,
    templateKey: "auth.password_reset",
    variables: {
      userName: user.fullName,
      userEmail: user.email,
      resetUrl: resetUrl.toString(),
      expiresInMinutes: String(RESET_TOKEN_TTL_MINUTES),
      primaryActionLabel: "Reset password",
    },
    metadata: {
      resetTokenStoredAsHash: true,
      expiresAt: expiresAt.toISOString(),
      tokenIncludedInLogs: false,
    },
  });

  await createAuditEvent({
    actorUserId: user.id,
    action: "user.password_reset_requested",
    targetType: "user",
    targetId: user.id,
    details: { emailSent: true, expiresAt: expiresAt.toISOString() },
    ...metadata,
  });

  return { message: RESET_EMAIL_SENT_MESSAGE, emailSent: true };
}

export async function resetPasswordWithToken(token: string, newPassword: string, metadata: RequestMetadata = {}) {
  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date() || resetToken.user.status !== UserStatus.active) {
    return {
      ok: false,
      message: "This reset link is invalid or expired. Please request a new password reset link.",
    };
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
        id: { not: resetToken.id },
      },
      data: { usedAt: now },
    }),
    prisma.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);

  await createAuditEvent({
    actorUserId: resetToken.userId,
    action: "user.password_reset_completed",
    targetType: "user",
    targetId: resetToken.userId,
    details: { activeSessionsRevoked: true },
    ...metadata,
  });

  return {
    ok: true,
    message: "Password reset successfully. Please sign in with your new password.",
  };
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "[invalid email]";
  return `${name.slice(0, 2)}***@${domain}`;
}
