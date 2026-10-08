import { useEffect, useState } from "react";
import { getHwid } from "./hwid";
import { api } from "./api";

const STORAGE_KEY = "docfix_license_cache";

function readCache() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(license) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    if (license) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(license));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

function getDefault() {
  return { loading: true, premium: false, license: null, error: null };
}

export function usePremium() {
  const [state, setState] = useState(() => {
    const cached = readCache();
    return {
      loading: true,
      premium: Boolean(cached),
      license: cached || null,
      error: null,
    };
  });

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const hwid = getHwid();
        if (!hwid) {
          if (mounted) {
            writeCache(null);
            setState({ loading: false, premium: false, license: null, error: null });
          }
          return;
        }

        // Look up any active license bound to this hardware fingerprint.
        const data = await api.get(`/licenses/me?status=active&limit=1&hwid=${encodeURIComponent(hwid)}`);
        const license = data.data?.licenses?.[0] || null;

        if (mounted) {
          writeCache(license);
          setState({ loading: false, premium: Boolean(license), license, error: null });
        }
      } catch (error) {
        if (mounted) {
          writeCache(null);
          setState({ loading: false, premium: false, license: null, error: error.message });
        }
      }
    };

    check();
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

export function verifyLicense(key, hwid) {
  return api.post("/licenses/verify", { key, hwid });
}

export function purchaseLicense({ tier, frequency, hwid, metadata }) {
  return api.post("/licenses/purchase", { tier, frequency, hwid, metadata });
}

export function clearPremiumCache() {
  writeCache(null);
}