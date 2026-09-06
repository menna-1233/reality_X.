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
