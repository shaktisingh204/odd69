'use client';

import { useState } from 'react';
import GameModeCard, { type GameMode } from './GameModeCard';
import GameModal from './GameModal';

export default function GameModesSection({
  modes,
  onPlay,
  className = 'flex w-full min-w-[280px] max-w-[320px] flex-col gap-5',
}: {
  modes: GameMode[];
  /** invoked when the user hits "Play" inside the modal — navigate to the real game */
  onPlay?: (mode: GameMode) => void;
  /** wrapper layout — defaults to a stacked column; pass a grid for a row */
  className?: string;
}) {
  const [active, setActive] = useState<GameMode | null>(null);

  return (
    <>
      <div className={className}>
        {modes.map((m) => (
          <GameModeCard key={m.title} mode={m} onClick={() => setActive(m)} />
        ))}
      </div>

      {active && (
        <GameModal
          data={{
            title: active.title,
            price: active.price,
            players: active.players,
            icon: active.icon,
            kind: active.kind,
            accent: active.art,
          }}
          onClose={() => setActive(null)}
          onPlay={
            onPlay
              ? () => {
                  onPlay(active);
                  setActive(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
