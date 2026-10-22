"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  icon?: ReactNode;
  label: string;
  shortLabel?: string;
}

/**
 * Highlights the current section; shared by the participant and admin shells.
 * Active and inactive classes are applied exclusively so that background and
 * text utilities never compete in the generated CSS.
 */
export function NavLinks({
  activeClassName,
  className,
  compact = false,
  exact = [],
  inactiveClassName = "",
  items,
}: {
  activeClassName: string;
  className: string;
  compact?: boolean;
  exact?: readonly string[];
  inactiveClassName?: string;
  items: readonly NavItem[];
}) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const active = exact.includes(item.href)
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`${className} ${active ? activeClassName : inactiveClassName}`}
            href={item.href}
            key={item.href}
          >
            {item.icon}
            <span>{compact ? (item.shortLabel ?? item.label) : item.label}</span>
          </Link>
        );
      })}
    </>
  );
}
