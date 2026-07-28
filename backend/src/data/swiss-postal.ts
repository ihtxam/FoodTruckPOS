import { readFileSync } from "fs";
import { join } from "path";

type PlzMap = Record<string, string[]>;

let cache: PlzMap | null = null;

function loadPlz(): PlzMap {
  if (cache) return cache;
  const path = join(__dirname, "swiss-plz.json");
  cache = JSON.parse(readFileSync(path, "utf8")) as PlzMap;
  return cache;
}

export type PostalSuggestion = {
  zip: string;
  city: string;
  cities: string[];
};

/**
 * Suggest Swiss PLZ codes (and city names) for autocomplete.
 * `q` may be a partial or full 4-digit postal code.
 */
export function suggestSwissPostal(q: string, limit = 12): PostalSuggestion[] {
  const digits = String(q || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length < 2) return [];
  const map = loadPlz();
  const out: PostalSuggestion[] = [];
  for (const zip of Object.keys(map)) {
    if (!zip.startsWith(digits)) continue;
    const cities = map[zip] || [];
    out.push({
      zip,
      city: cities[0] || "",
      cities,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function cityForSwissPostal(zip: string): string | null {
  const digits = String(zip || "").replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const cities = loadPlz()[digits];
  return cities?.[0] || null;
}
