import { Radio, ArrowUpRight, Headphones, ShieldCheck, Smile, Send } from 'lucide-react';
import Icon3D from './Icon3D';

export type ChatMessage = {
  id: string;
  name: string;
  time: string;
  text: string;
  tint: string;
  mention?: string;
};

const DEFAULT_MESSAGES: ChatMessage[] = [
  { id: '1', name: 'Aleksandr', time: '06:10', text: 'feels like it, got 3 greens on roulette in a row', tint: 'from-[#f97316] to-[#b45309]' },
  { id: '2', name: 'Runner', time: '06:12', text: 'worth it bro, M9 Doppler secured', tint: 'from-[#ef4444] to-[#7f1d1d]' },
  { id: '3', name: 'TechnoBomg', time: '06:13', text: 'yo join coinflip I got 50$ up', tint: 'from-[#22c55e] to-[#15803d]' },
  { id: '4', name: 'Cuplinkov', time: '06:13', text: 'nah bro last time u cleaned me', tint: 'from-[#38bdf8] to-[#1d4ed8]', mention: '@technobomg,' },
  { id: '5', name: 'MinskLover', time: '06:14', text: 'yeah, 5 tiles up then BOOM bomb', tint: 'from-[#a855f7] to-[#6b21a8]' },
  { id: '6', name: 'Godmaster', time: '06:15', text: 'anyone doing coinflip? got 30 up', tint: 'from-[#eab308] to-[#854d0e]' },
  { id: '7', name: 'Korneleus', time: '06:17', text: 'nah i just hit a red train on roulette', tint: 'from-[#06b6d4] to-[#0e7490]' },
  { id: '8', name: 'Mahmedov', time: '06:18', text: 'gg that is some run right there', tint: 'from-[#f43f5e] to-[#9f1239]' },
];

function Avatar({ name, tint }: { name: string; tint: string }) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br ${tint} text-[12px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default function ChatPanel({
  messages = DEFAULT_MESSAGES,
  onlineCount = 784,
  title = 'CHAT',
}: {
  /** chat feed — real recent wins when wired from the home */
  messages?: ChatMessage[];
  onlineCount?: number;
  title?: string;
} = {}) {
  return (
    <div className="flex w-[340px] flex-col overflow-hidden rounded-[26px] border border-white/[0.05] bg-[#0c1726]/95 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
      {/* Header banner */}
      <div className="relative overflow-hidden px-4 pb-3 pt-4">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_120%_at_20%_0%,#1d4ed8_0%,#0b1a30_55%,#0c1726_100%)]" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon3D name="chat" size={34} glow float />
            <span className="rounded-lg bg-[#0b1a30]/70 px-3 py-1.5 text-lg font-extrabold italic tracking-tight text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.4)]">
              {title}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-[#9fd2ff]">
              <Radio className="h-3.5 w-3.5" /> {onlineCount.toLocaleString('en-US')}
            </span>
          </div>
          <button
            type="button"
            className="odd69-press grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white shadow-[0_6px_16px_rgba(37,99,235,0.5)]"
            aria-label="Open chat"
          >
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="odd69-press flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.05] px-3 py-2.5 text-[12px] font-semibold text-white/90"
          >
            <Headphones className="h-4 w-4 text-[#9fb2c9]" /> Technical Support
          </button>
          <button
            type="button"
            className="odd69-press grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#0d9488] to-[#115e59] text-white shadow-[0_6px_16px_rgba(13,148,136,0.45)]"
            aria-label="Verified"
          >
            <ShieldCheck className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ul className="flex max-h-[520px] flex-col gap-3 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <li key={m.id} className="flex gap-2.5">
            <Avatar name={m.name} tint={m.tint} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-white">{m.name}</span>
                <span className="tabular-nums text-[10px] font-medium text-[#6f87a3]">{m.time}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-[#b6c6da]">
                {m.mention && <span className="font-semibold text-[#56a6ff]">{m.mention} </span>}
                {m.text}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Input */}
      <div className="border-t border-white/[0.05] p-3">
        <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.04] py-2 pl-4 pr-2">
          <input
            placeholder="Your message ..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-[#6f87a3] focus:outline-none"
          />
          <button type="button" className="odd69-press grid h-8 w-8 place-items-center rounded-lg text-[#9fb2c9] hover:text-white" aria-label="Emoji">
            <Smile className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="odd69-press grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white shadow-[0_6px_16px_rgba(37,99,235,0.5)]"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
