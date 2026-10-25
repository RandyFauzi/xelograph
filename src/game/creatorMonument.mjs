// One discoverable monument in the open southwest garden, away from questionnaire areas.
export const CREATOR_MONUMENT = {
  x: -10,
  z: 10,
  radius: 2.8,
  exitRadius: 4,
  asset: '/branding/randy-creator-monument.png',
  portfolio: 'https://randyfauzi.github.io/Randy-Fauzi-Portofolio/',
};

/** Hysteresis prevents the popup from reopening until the visitor leaves the monument. */
export function creatorProximity(position, latched, active) {
  const distance = Math.hypot(position.x - CREATOR_MONUMENT.x, position.z - CREATOR_MONUMENT.z);
  const near = distance <= CREATOR_MONUMENT.radius;
  if (distance > CREATOR_MONUMENT.exitRadius) latched = false;
  const open = active && near && !latched;
  return { near, open, latched: latched || open };
}
