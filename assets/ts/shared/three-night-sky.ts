import { Vector3 } from "three";

// Rust's sun travels through a tilted ellipse. Undo the horizontal compression
// before measuring its phase so the celestial sphere advances evenly through
// sunrise, noon, sunset, and midnight.
const RUST_SOLAR_HORIZONTAL_SCALE = 0.42;

export function raidlandsCelestialAngleFromSunDirection(direction: Vector3): number {
  const normalized = direction.clone().normalize();
  return Math.atan2(
    normalized.y,
    -normalized.x / RUST_SOLAR_HORIZONTAL_SCALE,
  );
}
