import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Wrench } from 'lucide-react';

interface MaintenanceStateProps {
    title: string;
    message: string;
    backHref?: string;
    backLabel?: string;
    fullScreen?: boolean;
}

export default function MaintenanceState({
    title,
    message,
    backHref = '/',
    backLabel = 'Return Home',
    fullScreen = false,
}: MaintenanceStateProps) {
    return (
        <div className={`${fullScreen ? 'min-h-screen' : 'h-full min-h-[calc(100vh-64px)]'} bg-[radial-gradient(circle_at_top,_rgba(255, 122, 26,0.18),_transparent_40%),linear-gradient(180deg,_#09090b_0%,_#111827_100%)] text-white`}>
            <div className="mx-auto flex h-full max-w-3xl items-center justify-center px-6 py-16">
                <div className="w-full rounded-[28px] border border-amber-400/20 bg-black/30 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
                    <div className="mb-6 flex items-center gap-3 text-warning-bright">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10">
                            <Wrench size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-200/75">Maintenance</p>
                            <p className="text-sm text-white/45">Service temporarily paused</p>
                        </div>
                    </div>

                    <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
                    <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-bright" />
                            <p className="text-sm leading-7 text-white/70 sm:text-base">{message}</p>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link
                            href={backHref}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-text-inverse transition hover:bg-amber-300"
                        >
                            <ArrowLeft size={16} />
                            {backLabel}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
