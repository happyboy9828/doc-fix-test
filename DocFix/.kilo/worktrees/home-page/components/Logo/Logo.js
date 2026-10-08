export default function Logo({ className, alt = "DocFix" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 60"
      role="img"
      aria-label={alt}
    >
      <defs>
        <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>

      <rect x="4" y="6" width="48" height="48" rx="12" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />

      <path d="M18 16h14l6 6v16a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V18a2 2 0 0 1 2-2z" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 16v6h6" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 28l3 3 7-7" fill="none" stroke="url(#brandGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      <text x="64" y="37" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontWeight="700" fontSize="24" fill="#0F172A">Doc</text>
      <text x="109" y="37" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontWeight="700" fontSize="24" fill="#2563EB">Fix</text>
    </svg>
  );
}