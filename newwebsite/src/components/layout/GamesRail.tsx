
import { Activity, Gamepad2, PlayCircle, Plane, BookOpen, Crown } from 'lucide-react';

export default function GamesRail() {
    return (
        <aside className="fixed right-0 top-[64px] bottom-0 w-[64px] bg-bg-elevated z-50 flex flex-col items-center py-4 gap-6 overflow-y-auto hidden xl:flex shadow-[-4px_0_20px_rgba(0,0,0,0.2)]">
            {/* Logo/Game Items */}
            <div className="flex flex-col items-center gap-1 cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-bg-hover flex items-center justify-center group-hover:bg-bg-section transition-colors relative">
                    <Activity size={20} className="text-text-primary" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-danger rounded-full animate-pulse"></span>
                </div>
                <span className="text-[9px] text-text-muted font-bold group-hover:text-text-primary text-center">Cricket</span>
            </div>

            <div className="flex flex-col items-center gap-1 cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-bg-hover flex items-center justify-center group-hover:bg-bg-section transition-colors">
                    <Crown size={20} className="text-jackpot" />
                </div>
                <span className="text-[9px] text-text-muted font-bold group-hover:text-text-primary text-center">Top Live<br />Dealer</span>
            </div>

            <div className="flex flex-col items-center gap-1 cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-bg-hover flex items-center justify-center group-hover:bg-bg-section transition-colors">
                    <Plane size={20} className="text-danger rotate-45" />
                </div>
                <span className="text-[9px] text-danger font-bold group-hover:text-text-primary text-center">Limbo</span>
            </div>

            <div className="flex flex-col items-center gap-1 cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-bg-hover flex items-center justify-center group-hover:bg-bg-section transition-colors">
                    <Gamepad2 size={20} className="text-accent-purple" />
                </div>
                <span className="text-[9px] text-accent-purple font-bold group-hover:text-text-primary text-center">JetX</span>
            </div>

            <div className="flex flex-col items-center gap-1 cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-bg-hover flex items-center justify-center group-hover:bg-bg-section transition-colors">
                    <Plane size={20} className="text-accent-blue rotate-12" />
                </div>
                <span className="text-[9px] text-accent-blue font-bold group-hover:text-text-primary text-center">Aviatrix</span>
            </div>

            <div className="flex flex-col items-center gap-1 cursor-pointer group mt-auto">
                <div className="w-10 h-10 rounded-full bg-bg-hover flex items-center justify-center group-hover:bg-bg-section transition-colors">
                    <BookOpen size={20} className="text-text-muted" />
                </div>
                <span className="text-[9px] text-text-muted font-bold group-hover:text-text-primary text-center">Tutorials</span>
            </div>

            {/* Chat Icon - often at bottom right */}
            <div className="w-12 h-12 bg-brand-gold rounded-full absolute bottom-4 flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer">
                <PlayCircle size={24} className="text-text-inverse fill-current" />
            </div>
        </aside>
    );
}
