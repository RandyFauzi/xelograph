export type JumpState = { height: number; velocity: number };
export function createJumpState(): JumpState;
export function stepJump(state: JumpState, dt: number, requested?: boolean): JumpState;
