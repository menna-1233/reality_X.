/** Matches the "lat, lon" text the app's own geolocation button writes into `location`. */
const LAT_LNG_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function parseLatLng(location: string): [number, number] | null {
  const match = LAT_LNG_RE.exec(location);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lat, lon];
}

const geocodeCache = new Map<string, Promise<string | null>>();

/**
 * Turns coordinates into a human-readable place name (street/neighborhood/
 * city) via OpenStreetMap's free Nominatim reverse-geocoding API — no API
 * key needed. Falls back to `null` on any network/parsing failure so
 * callers can keep showing the raw "lat, lon" instead.
 */
export function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  const cached = geocodeCache.get(key);
  if (cached) return cached;

  const promise = fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ar`,
  )
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const address = data?.display_name as string | undefined;
      return address ?? null;
    })
    .catch(() => null);

  geocodeCache.set(key, promise);
  return promise;
}

/** True for the raw "lat, lon" text the geolocation button writes — i.e. not yet a readable address. */
export function isRawCoordinates(location: string): boolean {
  return parseLatLng(location) !== null;
}
