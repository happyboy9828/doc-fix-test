"use client";

import { useState } from "react";
import { getHwid } from "../../utils/shared/hwid";
import { purchaseLicense, clearPremiumCache } from "../../utils/shared/usePremium";

const TIERS = [
  {
    id: "basic",
    name: "Basic",
    description: "Essential image tools for quick edits and conversions.",
    color: "#64748b",
    features: [
      "All 8 core tools",
      "Up to 10 files per batch",
      "Standard quality output",
      "No account required",
    ],
    prices: { weekly: 840, fortnightly: 1400, monthly: 2240 },
  },
  {
    id: "pro",
    name: "Pro",
    description: "Advanced features for designers and power users.",
    color: "#f59e0b",
    highlighted: true,
    features: [
      "Everything in Basic",
      "Up to 50 files per batch",
      "High quality + lossless output",
      "Priority processing",
      "Batch ZIP downloads",
      "No ads",
    ],
    prices: { weekly: 1680, fortnightly: 2800, monthly: 4200 },
  },
  {
    id: "ultra",
    name: "Ultra",
    description: "Unlimited access for teams and heavy workloads.",
    color: "#8b5cf6",
    features: [
      "Everything in Pro",
      "Unlimited file batches",
      "API access",
      "Custom export presets",
      "Dedicated support",
      "Team seats included",
    ],
    prices: { weekly: 2800, fortnightly: 4760, monthly: 7000 },
  },
];

const FREQUENCIES = [
  { id: "weekly", label: "Weekly", badge: "Most flexible" },
  { id: "fortnightly", label: "Fortnightly", badge: "Best value" },
  { id: "monthly", label: "Monthly", badge: "Most popular" },
];

export default function PricingTable() {
  const [frequency, setFrequency] = useState("fortnightly");
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePurchase = async (tier) => {
    setBusy(tier.id);
    setError(null);
    setResult(null);
    try {
      const hwid = getHwid();
      if (!hwid) {
        throw new Error("Could not generate a hardware ID for this device.");
      }
      const res = await purchaseLicense({ tier: tier.id, frequency, hwid });
      clearPremiumCache();
      setResult(res.data.license);
    } catch (err) {
      setError(err.message || "Purchase failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pricing-shell">
      <div className="pricing-freqs" role="tablist" aria-label="Billing frequency">
        {FREQUENCIES.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={frequency === f.id}
            className={`pricing-freq ${frequency === f.id ? "pricing-freq--active" : ""}`}
            onClick={() => setFrequency(f.id)}
          >
            {f.label}
            <span className="pricing-freq-badge">{f.badge}</span>
          </button>
        ))}
      </div>

      {result && (
        <div className="pricing-success" role="status">
          <p className="pricing-success-title">Premium activated</p>
          <p className="pricing-success-key">
            License key: <code>{result.key}</code>
          </p>
          <p className="pricing-success-meta">
            {result.tier} · {result.frequency} · valid until{" "}
            {new Date(result.expiresAt).toLocaleDateString()}
          </p>
          <p className="pricing-success-note">
            This key is bound to your device (HWID {result.hwid}). It will be
            verified automatically on every session.
          </p>
        </div>
      )}

      {error && (
        <div className="pricing-error" role="alert">
          {error}
        </div>
      )}

      <div className="pricing-grid">
        {TIERS.map((tier) => (
          <article
            key={tier.id}
            className={`pricing-card ${tier.highlighted ? "pricing-card--featured" : ""}`}
            style={
              tier.highlighted
                ? {
                    borderColor: tier.color,
                    boxShadow: `0 0 0 1px ${tier.color}33, 0 20px 40px -20px ${tier.color}33`,
                  }
                : undefined
            }
          >
            {tier.highlighted && (
              <div className="pricing-card-badge" style={{ background: tier.color }}>
                Recommended
              </div>
            )}

            <header className="pricing-card-header">
              <h3 className="pricing-tier-name">{tier.name}</h3>
              <p className="pricing-tier-desc">{tier.description}</p>
            </header>

            <div className="pricing-price-wrap">
              <span className="pricing-currency">Rs</span>
              <span className="pricing-amount">{tier.prices[frequency].toFixed(2)}</span>
              <span className="pricing-period">/ {frequency}</span>
            </div>

            <ul className="pricing-features">
              {tier.features.map((feature) => (
                <li key={feature} className="pricing-feature">
                  <svg aria-hidden="true" className="pricing-check" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              className={`pricing-cta ${tier.highlighted ? "pricing-cta--featured" : ""}`}
              style={
                tier.highlighted
                  ? {
                      background: `linear-gradient(135deg, var(--pro-gradient-start), var(--pro-gradient-end))`,
                      color: "var(--tool-on-accent)",
                    }
                  : undefined
              }
              onClick={() => handlePurchase(tier)}
              disabled={busy === tier.id}
            >
              {busy === tier.id ? "Activating..." : `Get ${tier.name}`}
            </button>
          </article>
        ))}
      </div>

      <p className="pricing-guarantee">
        Cancel anytime. No questions asked. All plans run locally in your browser — no uploads, no account required to try.
      </p>
    </div>
  );
}