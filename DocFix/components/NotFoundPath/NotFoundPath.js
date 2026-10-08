"use client";

import { usePathname } from "next/navigation";

export default function NotFoundPath() {
  const pathname = usePathname();

  if (!pathname || pathname === "/404") return null;

  return (
    <p className="nf-path">
      <span className="nf-path-label">Requested</span>
      <code className="nf-path-value">{pathname}</code>
    </p>
  );
}