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
      {config.character === 'female' && config.hair !== 'ponytail' && (
        <path
          d={config.hair === 'hijab' ? 'M87 125H133L145 172H75Z' : 'M87 129H133L147 162H73Z'}
          fill={shirt}
        />
      )}
      {config.hair === 'quiff' && <path d="M104 105H116V142H104Z" fill="#f6f3e7" />}
      {(config.hair === 'ponytail' || config.hair === 'cap') && (
        <path d="M102 109V125M118 109V125" stroke="#f6f3e7" strokeWidth="2" />
      )}
      {config.hair === 'ponytail' && <ellipse cx="141" cy="89" rx="13" ry="29" fill="#342a22" />}
      {config.hair === 'hijab' && (
        <path d="M73 72Q70 34 110 34Q150 34 147 75L148 113Q110 130 72 113Z" fill="#d9c9ab" />
      )}
      {config.hair === 'long' && (
        <path
          d="M73 76Q70 36 110 36Q150 36 148 76L150 126L134 131L130 91H90L86 131L70 125Z"
          fill="#342a22"
        />
      )}
      {config.hair === 'bob' && (
        <rect x="76" y="44" width="68" height="65" rx="28" fill="#342a22" />
      )}
      <ellipse cx="110" cy="77" rx="31" ry="34" fill={skin} />
      {(config.hair === 'short' || config.hair === 'ponytail') && (
        <path d="M79 72Q72 39 104 38Q143 34 141 70L130 62L120 54L103 60L86 59Z" fill="#342a22" />
      )}
      {config.hair === 'quiff' && (
        <path
          d="M78 70Q73 42 96 39L122 27Q123 38 141 48L142 70L126 54L104 60L88 58Z"
          fill="#342a22"
        />
      )}
      {config.hair === 'hijab' && (
        <path
          d="M75 78Q70 38 110 38Q151 38 145 80L137 98L133 65Q110 48 87 65L82 99Z"
          fill="#d9c9ab"
        />
      )}
      {(config.hair === 'bob' || config.hair === 'long') && (
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
