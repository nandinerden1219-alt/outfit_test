"use client";

import { ChevronsUpDownIcon, LogOutIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/types/user";

function initials(user: AppUser): string {
  const source = user.display_name?.trim() || user.email;
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({ user, compact = false }: { user: AppUser; compact?: boolean }) {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/auth/signout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-3 rounded-xl text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40",
          compact ? "p-0.5" : "w-full px-2 py-2 hover:bg-sidebar-accent",
        )}
        aria-label="Account menu"
      >
        <Avatar className="size-9">
          <AvatarFallback className="bg-secondary text-xs font-semibold">{initials(user)}</AvatarFallback>
        </Avatar>
        {!compact && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.display_name ?? "Your account"}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRoundIcon />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
