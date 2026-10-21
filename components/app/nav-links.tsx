"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

/** Highlights the current section; shared by the participant and admin shells. */
export function NavLinks({
  activeClassName,
  className,
  exact = [],
  items,
}: {
  activeClassName: string;
  className: string;
  exact?: readonly string[];
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
            className={`${className} ${active ? activeClassName : ""}`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
