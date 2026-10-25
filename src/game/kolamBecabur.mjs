// Interactive Kolam Becabur landmark replacing the east waterside pond at (18, 12).
export const KOLAM_BECABUR = {
  x: 18,
  z: 12,
  y: 0.11,
  scale: 1.9,
  radius: 4.0,
  exitRadius: 5.2,
  walkTarget: { x: 14.6, z: 12 },
  model: '/models/kolam_becabur.glb',
  preview: '/branding/kolam-becabur-preview.png',
  video: '/videos/kolam-becabur.mp4',
  driveUrl:
    'https://drive.google.com/drive/folders/1ppKqf6hUb-9wD-gvKZlzVK7wrXCkSBh_?usp=sharing',
  title: 'Kolam Becabur',
};

/** Hysteresis prevents the video popup from reopening until the visitor leaves the pond area. */
export function kolamProximity(position, latched, active) {
  const distance = Math.hypot(position.x - KOLAM_BECABUR.x, position.z - KOLAM_BECABUR.z);
  const near = distance <= KOLAM_BECABUR.radius;
  if (distance > KOLAM_BECABUR.exitRadius) latched = false;
  const open = active && near && !latched;
  return { near, open, latched: latched || open };
}
