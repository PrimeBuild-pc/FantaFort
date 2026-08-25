// Curated profile emblem: initials on a themed plate. The theme is a slug the account
// owns, never an uploaded image, so nothing here can carry personal data.
export default function Emblem({ username, style, className = '' }: { username:string; style?:string|null; className?:string }) {
  return <span className={`emblem avatar-${style || 'default'} ${className}`.trim()} aria-hidden="true">
    {(username || 'P').slice(0, 2).toUpperCase()}
  </span>;
}
