'use client';
import dynamic from 'next/dynamic';
const Game = dynamic(() => import('../App'), {
  ssr: false,
  loading: () => (
    <div className="game-loading boot-screen">
      <span className="loading-emblem">x</span>
      <p>Menyiapkan kampus kecil kita…</p>
    </div>
  ),
});
export default function GameClient() {
  return <Game />;
}
