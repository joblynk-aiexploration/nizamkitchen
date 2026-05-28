"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white disabled:text-slate-400"
    >
      <LogOut className="h-4 w-4 shrink-0" />
      <span>{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}

export function LogoutForm() {
  return (
    <form action="/api/auth/logout" method="post">
      <SignOutButton />
    </form>
  );
}
