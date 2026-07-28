/**
 * Nominatim forward geocode (OpenStreetMap).
 * Server-side only — respects OSM usage policy via User-Agent.
 */
export async function geocodeQuery(
  query: string
): Promise<{ found: false } | { found: true; lat: number; lng: number; displayName?: string }> {
  const q = String(query || "").trim();
  if (!q) return { found: false };

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Chaslay-POS/1.0 (https://app.chaslay.com)",
    },
  });
  if (!response.ok) {
    throw new Error("Geocoding unavailable");
  }
  const data = (await response.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
  if (!data?.[0]) return { found: false };
  const lat = Number(data[0].lat);
  const lng = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { found: false };
  return {
    found: true,
    lat,
    lng,
    displayName: data[0].display_name,
  };
}
