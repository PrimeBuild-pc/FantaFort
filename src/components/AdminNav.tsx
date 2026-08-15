"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/players', label: 'Players' },
  { href: '/admin/badges', label: 'Badges' },
  { href: '/admin/privacy', label: 'Privacy' },
  { href: '/admin/errors', label: 'Errors' },
  { href: '/admin/audit', label: 'Audit' },
];

export default function AdminNav() {
  const pathname = usePathname();
  return <nav className="admin-nav" aria-label="Admin sections">
    <div className="container admin-nav-inner">
      {LINKS.map(link => {
        const active = link.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(link.href);
        return <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''}>{link.label}</Link>;
      })}
    </div>
  </nav>;
}
