import { useEffect, useState } from "react";
import { assetUrl } from "./asset-url.ts";
import { loadVolume } from "./imaging";
import type { Volume, VolumeAsset } from "./imaging";

export function useJSON<T>(url: string) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch(assetUrl(url), { signal: controller.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error("The research catalogue could not be loaded.");
        return response.json();
      })
      .then(setValue)
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [url, attempt]);
  return { value, error, retry: () => setAttempt((n) => n + 1) };
}
export function useVolume(asset: VolumeAsset | undefined) {
  const [loaded, setLoaded] = useState<{ url: string; data: Volume } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setError("");
    if (!asset) {
      setLoaded(null);
      return;
    }
    loadVolume(asset)
      .then((data) => {
        if (current) setLoaded({ url: asset.url, data });
      })
      .catch((error) => {
        if (current) setError(error.message);
      });
    return () => {
      current = false;
    };
  }, [asset?.url, attempt]);
  return {
    data: loaded?.url === asset?.url ? (loaded?.data ?? null) : null,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}
