type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceMeters(origin: Coordinates, destination: Coordinates) {
  const latDelta = toRadians(destination.latitude - origin.latitude);
  const lngDelta = toRadians(destination.longitude - origin.longitude);
  const startLat = toRadians(origin.latitude);
  const endLat = toRadians(destination.latitude);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}
