import { useRef, useState } from 'react';
export default function Joystick({ stick }: { stick: React.RefObject<{ x: number; y: number }> }) {
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  const release = () => {
    pointer.current = null;
    stick.current = { x: 0, y: 0 };
    setThumb({ x: 0, y: 0 });
  };
  const update = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const max = r.width * 0.28;
    let x = e.clientX - r.left - r.width / 2,
      y = e.clientY - r.top - r.height / 2;
    const distance = Math.hypot(x, y);
    if (distance > max) {
      x = (x / distance) * max;
      y = (y / distance) * max;
    }
    stick.current = { x: x / max, y: y / max };
    setThumb({ x, y });
  };
  return (
    <div className="analog-control">
      <div
        className="analog-joystick"
        role="group"
        aria-label="Joystick: geser untuk berjalan"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => {
          if (pointer.current === e.pointerId) update(e);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <span className="joystick-axis axis-h" />
        <span className="joystick-axis axis-v" />
        <span
          className="joystick-thumb"
          style={{ transform: `translate(${thumb.x}px,${thumb.y}px)` }}
        />
      </div>
      <span>GERAKKAN</span>
    </div>
  );
}
