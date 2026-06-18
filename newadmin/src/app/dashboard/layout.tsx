import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="dashboard-shell min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
            <Sidebar />
            <div className="min-h-screen min-w-0 transition-all duration-300 lg:ml-[280px]">
                <main className="dashboard-main mx-auto w-full min-w-0 px-4 pb-6 pt-20 sm:px-6 sm:pb-8 sm:pt-24 lg:px-8 lg:pt-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
