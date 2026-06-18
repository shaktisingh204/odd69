import { Suspense } from "react";
import SuperVoidEventClient from "./SuperVoidEventClient";

function SuperVoidEventFallback() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Super Void Event</h1>
                    <p className="mt-1 text-slate-400">Loading event controls...</p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
                Preparing super-void workflow...
            </div>
        </div>
    );
}

export default function SuperVoidEventPage() {
    return (
        <Suspense fallback={<SuperVoidEventFallback />}>
            <SuperVoidEventClient />
        </Suspense>
    );
}
