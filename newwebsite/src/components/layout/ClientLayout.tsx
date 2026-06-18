"use client";

import React, { useEffect } from "react";
import { ModalProvider, useModal } from "@/context/ModalContext";
import LoginModal from "@/components/LoginModal/LoginModal";
import RegisterModal from "@/components/RegisterModal/RegisterModal";
import DepositModal from "@/components/DepositModal/DepositModal";
import WithdrawModal from "@/components/WithdrawModal/WithdrawModal";
import DepositChooserSheet from "@/components/DepositModal/DepositChooserSheet";
import ManualDepositScreen from "@/components/DepositModal/ManualDepositScreen";
import { AuthProvider } from "@/context/AuthContext";
import { BetProvider } from "@/context/BetContext";
import { SocketProvider } from "@/context/SocketContext";
import { LayoutProvider } from "@/context/LayoutContext";
import { WalletProvider } from "@/context/WalletContext";
import PageTransition from "./PageTransition";
import MobileBottomNav from "./MobileBottomNav";
import MobileCategoryBar from "./MobileCategoryBar";
import { Toaster } from "react-hot-toast";
import AnnouncementBanner from "./AnnouncementBanner";
import NotificationPermissionPrompt from "@/components/NotificationPermissionPrompt";
import { captureUtm } from "@/lib/utm";
import DailyCheckInAutoPrompt from "@/components/DailyCheckIn/DailyCheckInAutoPrompt";
import SignupDepositPrompt from "@/components/SignupDepositPrompt";
import RightSidebar from "@/components/layout/RightSidebar";
import WagerProgressWidget from "@/components/layout/WagerProgressWidget";
import PendingDepositWidget from "@/components/layout/PendingDepositWidget";
import PlatformMaintenanceGuard from "@/components/maintenance/PlatformMaintenanceGuard";

const ModalContainer = () => {
    const {
        isLoginOpen, closeLogin,
        isRegisterOpen, closeRegister, openLogin, openRegister,
        isDepositChooserOpen, closeDeposit,
        isDepositOpen, openUPIDeposit, closeUPIDeposit,
        isManualDepositOpen, manualDepositAllowBack, openManualDeposit, closeManualDeposit,
        isWithdrawOpen, closeWithdraw,
    } = useModal();

    return (
        <>
            {isLoginOpen && <LoginModal onClose={closeLogin} onRegisterClick={openRegister} />}
            {isRegisterOpen && <RegisterModal onClose={closeRegister} onLoginClick={openLogin} />}

            {/* Deposit chooser — entry point */}
            <DepositChooserSheet
                key={isDepositChooserOpen ? 'deposit-chooser-open' : 'deposit-chooser-closed'}
                isOpen={isDepositChooserOpen}
                onClose={closeDeposit}
                onChooseDeposit={openUPIDeposit}
                onChooseCrypto={() => openUPIDeposit({ initialTab: 'crypto', allowFiatTab: false })}
                onChooseManual={() => openManualDeposit({ allowBack: false })}
            />

            {/* UPI gateway deposit — separate full modal */}
            <DepositModal isOpen={isDepositOpen} onClose={closeUPIDeposit} />

            {/* Manual UPI deposit — separate full sheet */}
            <ManualDepositScreen
                isOpen={isManualDepositOpen}
                onClose={closeManualDeposit}
                onBackToGateway={() => { closeManualDeposit(); openUPIDeposit(); }}
                allowBack={manualDepositAllowBack}
            />

            {isWithdrawOpen && <WithdrawModal onClose={closeWithdraw} />}
        </>
    );
};

export default function ClientLayout({ children, maintenanceConfig }: { children: React.ReactNode; maintenanceConfig?: any }) {
    // Capture UTM params on every page load — first attribution wins
    useEffect(() => { captureUtm(); }, []);

    const isBlocked = maintenanceConfig?.platformBlocked ?? false;
    const message = maintenanceConfig?.platformMessage ?? '';
    const allowedUsers = maintenanceConfig?.allowedUsers ?? [];

    return (
        <AuthProvider>
            <SocketProvider>
                <ModalProvider>
                    <WalletProvider>
                        <BetProvider>
                            <LayoutProvider>
                                <PlatformMaintenanceGuard isBlocked={isBlocked} message={message} allowedUsers={allowedUsers}>
                                    <AnnouncementBanner />
                                    <React.Suspense fallback={<div className="h-[50px] md:hidden bg-bg-modal" />}>
                                        <MobileCategoryBar />
                                    </React.Suspense>

                                    <div className="flex flex-row w-full h-[100dvh]">
                                        <div className="flex-1 min-w-0 flex flex-col relative">
                                            <PageTransition>
                                                {children}
                                            </PageTransition>
                                        </div>
                                        <RightSidebar />
                                    </div>
                                    <MobileBottomNav />
                                </PlatformMaintenanceGuard>
                                <ModalContainer />
                                <NotificationPermissionPrompt />
                                <DailyCheckInAutoPrompt />
                                <SignupDepositPrompt />
                                <WagerProgressWidget />
                                <PendingDepositWidget />
                                <Toaster position="top-center" toastOptions={{
                                    style: {
                                        background: '#171921',
                                        color: '#E8ECF4',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '12px',
                                    },
                                }} />

                            </LayoutProvider>
                        </BetProvider>
                    </WalletProvider>
                </ModalProvider>
            </SocketProvider>
        </AuthProvider>
    );
}
