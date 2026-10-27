// Interactive Shop landmark replacing the cafe/store building at (19, -11.8).
export const SHOP_BUILDING = {
  x: 19,
  z: -10.5,
  y: 0.2,
  radius: 3.2,
  exitRadius: 4.4,
  walkTarget: { x: 19, z: -9.5 },
  title: 'Shop',
};

/** Hysteresis prevents the shop modal from repeatedly reopening until visitor leaves. */
export function shopProximity(position, latched, active) {
  const distance = Math.hypot(position.x - SHOP_BUILDING.x, position.z - SHOP_BUILDING.z);
  const near = distance <= SHOP_BUILDING.radius;
  if (distance > SHOP_BUILDING.exitRadius) latched = false;
  const open = active && near && !latched;
  return { near, open, latched: latched || open };
}
