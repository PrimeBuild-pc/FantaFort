import Link from 'next/link';

export default function NotFound() {
  return <main className="auth-shell"><section className="epic-panel auth-card"><div className="eyebrow">404</div><h1>Page not found</h1><p>This page does not exist or has moved.</p><Link className="epic-button" href="/">FantaFort home</Link></section></main>;
}
