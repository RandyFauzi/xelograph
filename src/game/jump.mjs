export function createJumpState() {
  return { height: 0, velocity: 0 };
}
export function stepJump(state, dt, requested = false) {
  dt = Math.max(0, Math.min(dt, 0.04));
  let { height, velocity } = state;
  if (requested && height === 0 && velocity === 0) velocity = 6.1;
  if (height > 0 || velocity > 0) {
    velocity -= 17.5 * dt;
    height += velocity * dt;
  }
  if (height <= 0) {
    height = 0;
    velocity = 0;
  }
  return { height, velocity };
}
