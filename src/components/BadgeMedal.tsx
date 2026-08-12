// Distinct medal artwork per badge, inline so there is no extra request and the
// shapes inherit currentColor. Decorative only: the accessible name comes from the
// surrounding badge element, so every SVG is aria-hidden.
const RIBBON = <path d="M9 20.5 12 27l3-2.2L18 27l3-6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;

const ART: Record<string, React.ReactNode> = {
  // Founding 50 — a laurel around the number, for the first real accounts.
  founder: <>
    <circle cx="15" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M8 12a7 7 0 0 0 4 6M22 12a7 7 0 0 1-4 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <text x="15" y="15.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="currentColor">50</text>
    {RIBBON}
  </>,
  // Beta — a flask, for the people who broke things early.
  beta: <>
    <path d="M12 4v6l-4.5 8A2 2 0 0 0 9.3 21h11.4a2 2 0 0 0 1.8-3L18 10V4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M10.5 4h9M9.6 15.5h10.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </>,
  // Top 10 — a crown.
  'rank-10': <>
    <path d="M5 18 3.5 7l5 3.5L15 3l6.5 7.5 5-3.5L25 18Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M5 21h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </>,
  // Top 50 — a chevron stack, one step below the crown.
  'rank-50': <>
    <path d="M6 14 15 6l9 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M6 21l9-8 9 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
  </>,
  // Contributor — a spark, for a verified contribution.
  contributor: <>
    <path d="M15 3.5 17.8 11l7.7 2.8-7.7 2.8L15 24.3l-2.8-7.7L4.5 13.8 12.2 11Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </>,
};

const FALLBACK = <>
  <circle cx="15" cy="13" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
  <circle cx="15" cy="13" r="3.5" fill="currentColor" />
  {RIBBON}
</>;

export default function BadgeMedal({ icon }: { icon: string }) {
  return <svg className="badge-medal" viewBox="0 0 30 30" aria-hidden="true" focusable="false">{ART[icon] ?? FALLBACK}</svg>;
}
