import { Check } from 'lucide-react';
import AvatarPortrait from './AvatarPortrait';
import { COLORS, type AvatarConfig } from './types';
import { AVATAR_MODELS, selectAvatarCharacter } from './game/avatarCatalog.mjs';
export default function AvatarOptions({
  avatar,
  setAvatar,
}: {
  avatar: AvatarConfig;
  setAvatar: (avatar: AvatarConfig) => void;
}) {
  return (
    <div className="avatar-options">
      <label>Pilih karakter</label>
      <div className="character-options" role="group" aria-label="Pilihan karakter">
        {(['male', 'female'] as const).map((character) => (
          <button
            type="button"
            key={character}
            aria-pressed={(avatar.character || 'male') === character}
            className={(avatar.character || 'male') === character ? 'selected' : ''}
            onClick={() => setAvatar(selectAvatarCharacter(avatar, character))}
          >
            <AvatarPortrait
              config={{
                ...avatar,
                character,
                hair: character === 'female' ? 'long' : 'short',
              }}
            />
            <span>{character === 'female' ? 'Perempuan' : 'Laki-laki'}</span>
          </button>
        ))}
      </div>
      <label>Model {avatar.character === 'female' ? 'perempuan' : 'pria'}</label>
      <div
        className="avatar-model-options"
        role="group"
        aria-label={
          avatar.character === 'female' ? 'Pilihan model perempuan' : 'Pilihan model pria'
        }
      >
        {AVATAR_MODELS[avatar.character || 'male'].map((model) => (
          <button
            type="button"
            key={model.id}
            aria-pressed={avatar.hair === model.id}
            aria-label={`${model.label}: ${model.description}`}
            className={avatar.hair === model.id ? 'selected' : ''}
            onClick={() => setAvatar({ ...avatar, hair: model.id })}
          >
            <img src={model.preview} alt="" width="72" height="96" />
            <strong>{model.label}</strong>
            <small>{model.description}</small>
          </button>
        ))}
      </div>
      <label>Warna pakaian</label>
      <div className="swatches">
        {(['sage', 'clay', 'navy', 'cream'] as const).map((v) => (
          <button
            type="button"
            key={v}
            aria-label={'Pakaian ' + v}
            aria-pressed={avatar.outfit === v}
            className={avatar.outfit === v ? 'chosen' : ''}
            style={{ background: COLORS[v] }}
            onClick={() => setAvatar({ ...avatar, outfit: v })}
          >
            {avatar.outfit === v && <Check size={15} />}
          </button>
        ))}
      </div>
      <label>Warna kulit</label>
      <div className="swatches">
        {(['light', 'warm', 'deep'] as const).map((v) => (
          <button
            type="button"
            key={v}
            aria-label={'Warna kulit ' + v}
            aria-pressed={avatar.skin === v}
            className={avatar.skin === v ? 'chosen' : ''}
            style={{ background: COLORS[v] }}
            onClick={() => setAvatar({ ...avatar, skin: v })}
          >
            {avatar.skin === v && <Check size={15} />}
          </button>
        ))}
      </div>
    </div>
  );
}
