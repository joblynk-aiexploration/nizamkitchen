import { Button } from "@/components/ui/button";

export function LogoutForm() {
  return (
    <form action="/api/auth/logout" method="post">
      <Button
        type="submit"
        variant="ghost"
        className="w-full justify-start px-0 text-slate-200 hover:bg-transparent hover:text-white"
      >
        Sign out
      </Button>
    </form>
  );
}
