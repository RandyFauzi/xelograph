import { COLORS, type AvatarConfig } from './types';
// Flat portrait of the same modular Blender character; keeps directory GPU usage constant.
export default function AvatarPortrait({ config }: { config: AvatarConfig }) {
  const skin = COLORS[config.skin],
    shirt = COLORS[config.outfit];
  return (
    <svg
      viewBox="0 0 220 200"
      width="100%"
      height="100%"
      role="img"
      aria-label="Potret karakter alumni"
    >
      <ellipse cx="110" cy="182" rx="45" ry="8" fill="#bdc9ab" opacity=".4" />
      <rect x="84" y="143" width="20" height="34" rx="7" fill="#35493c" />
      <rect x="116" y="143" width="20" height="34" rx="7" fill="#35493c" />
      <rect x="80" y="171" width="25" height="11" rx="5" fill="#e2d7b9" />
      <rect x="115" y="171" width="25" height="11" rx="5" fill="#e2d7b9" />
      <rect x="69" y="104" width="18" height="47" rx="8" fill={shirt} />
      <rect x="133" y="104" width="18" height="47" rx="8" fill={shirt} />
      <circle cx="78" cy="150" r="8" fill={skin} />
      <circle cx="142" cy="150" r="8" fill={skin} />
      <rect x="82" y="101" width="56" height="51" rx="13" fill={shirt} />
      {config.hair === 'bob' && (
        <rect x="76" y="44" width="68" height="65" rx="28" fill="#342a22" />
      )}
      <ellipse cx="110" cy="77" rx="31" ry="34" fill={skin} />
      {config.hair === 'short' && (
        <path d="M79 72Q72 39 104 38Q143 34 141 70L130 62L120 54L103 60L86 59Z" fill="#342a22" />
      )}
      {config.hair === 'bob' && (
        <path d="M78 72Q78 37 110 39Q145 39 142 75L129 54Q108 70 78 72Z" fill="#342a22" />
      )}
      {config.hair === 'cap' && (
        <>
          <path d="M78 61Q78 33 111 34Q143 36 142 61Z" fill="#b87456" />
          <rect x="75" y="57" width="76" height="8" rx="4" fill="#a7664c" />
        </>
      )}
      <circle cx="99" cy="78" r="2.5" fill="#2c3d30" />
      <circle cx="121" cy="78" r="2.5" fill="#2c3d30" />
      <path
        d="M105 91Q110 95 115 91"
        fill="none"
        stroke="#634830"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
