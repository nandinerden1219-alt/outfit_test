import { Brand } from "@/components/shared/brand";
import { MobileNav, SidebarNav } from "@/components/layout/nav";
import { UserMenu } from "@/components/layout/user-menu";
import type { AppUser } from "@/types/user";

type AppShellProps = {
  user: AppUser;
  children: React.ReactNode;
};

/**
 * Authenticated app frame: fixed sidebar on desktop, bottom tab bar on mobile.
 * Content is constrained to a comfortable reading width and never fights the nav.
 */
export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="flex min-h-svh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand href="/home" />
        </div>
        <SidebarNav className="mt-8 flex-1" />
        <UserMenu user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-canvas/85 px-5 py-3.5 backdrop-blur lg:hidden">
          <Brand href="/home" size="sm" />
          <UserMenu user={user} compact />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-8 sm:pt-10 lg:pb-16">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
