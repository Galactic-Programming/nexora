"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tourism/ui/components/custom/dropdown-menu-custom";
import {
  Avatar,
  AvatarFallback,
} from "@tourism/ui/components/custom/avatar-custom";
import { signOutAction } from "@/features/auth/actions";

/** Client dropdown for the signed-in user: Account link + Sign out. */
export function UserMenuActions({ email }: { email: string }) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = email.charAt(0).toUpperCase();

  function onSignOut() {
    startTransition(async () => {
      await signOutAction();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        className="flex items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={email}
      >
        <Avatar className="size-8">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel
            className="max-w-48 truncate"
            data-testid="user-email"
          >
            {email}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/account" />}
          nativeButton={false}
        >
          {t("account")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut} disabled={pending}>
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
