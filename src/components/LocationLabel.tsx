import { useEffect, useState } from "react";
import { isRawCoordinates, parseLatLng, reverseGeocode } from "../lib/geo";

/**
 * Renders a report's `location` text, resolving it to a human-readable
 * address when it's still raw "lat, lon" (e.g. reports saved before
 * reverse-geocoding was added to the report form). Shows the coordinates
 * immediately and swaps in the address once it resolves, so places never
 * look blank while loading.
 */
export function LocationLabel({ location }: { location: string }) {
  const [label, setLabel] = useState(location);

  useEffect(() => {
    setLabel(location);
    if (!isRawCoordinates(location)) return;
    const coords = parseLatLng(location);
    if (!coords) return;
    let cancelled = false;
    reverseGeocode(coords[0], coords[1]).then((address) => {
      if (!cancelled && address) setLabel(address);
    });
    return () => {
      cancelled = true;
    };
  }, [location]);

  return <>{label}</>;
}
