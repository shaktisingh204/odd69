"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface ModalContextType {
    isLoginOpen: boolean;
    openLogin: () => void;
    closeLogin: () => void;
    isRegisterOpen: boolean;
    openRegister: () => void;
    closeRegister: () => void;
    // Deposit chooser (the entry point)
    isDepositChooserOpen: boolean;
    openDeposit: () => void;          // opens chooser sheet
    closeDeposit: () => void;
    // UPI gateway deposit
    isDepositOpen: boolean;
    depositInitialTab: 'fiat' | 'crypto' | null;
    depositAllowFiatTab: boolean;
    openUPIDeposit: (options?: { initialTab?: 'fiat' | 'crypto'; allowFiatTab?: boolean }) => void;
    closeUPIDeposit: () => void;
    // Manual UPI deposit
    isManualDepositOpen: boolean;
    manualDepositAllowBack: boolean;
    openManualDeposit: (options?: { allowBack?: boolean }) => void;
    closeManualDeposit: () => void;
    // Withdraw
    isWithdrawOpen: boolean;
    openWithdraw: () => void;
    closeWithdraw: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [isDepositChooserOpen, setIsDepositChooserOpen] = useState(false);
    const [isDepositOpen, setIsDepositOpen] = useState(false);
    const [depositInitialTab, setDepositInitialTab] = useState<'fiat' | 'crypto' | null>(null);
    const [depositAllowFiatTab, setDepositAllowFiatTab] = useState(true);
    const [isManualDepositOpen, setIsManualDepositOpen] = useState(false);
    const [manualDepositAllowBack, setManualDepositAllowBack] = useState(true);
    const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

    const resetDepositMode = () => {
        setDepositInitialTab(null);
        setDepositAllowFiatTab(true);
    };

    const closeAll = () => {
        setIsLoginOpen(false);
        setIsRegisterOpen(false);
        setIsDepositChooserOpen(false);
        setIsDepositOpen(false);
        resetDepositMode();
        setIsManualDepositOpen(false);
        setManualDepositAllowBack(true);
        setIsWithdrawOpen(false);
    };

    const openLogin = () => { closeAll(); setIsLoginOpen(true); };
    const closeLogin = () => setIsLoginOpen(false);

    const openRegister = () => { closeAll(); setIsRegisterOpen(true); };
    const closeRegister = () => setIsRegisterOpen(false);

    // openDeposit → opens the chooser sheet which auto-routes based on gateway config
    const openDeposit = () => { closeAll(); setIsDepositChooserOpen(true); };
    const closeDeposit = () => { setIsDepositChooserOpen(false); setIsDepositOpen(false); resetDepositMode(); setIsManualDepositOpen(false); setManualDepositAllowBack(true); };

    const openUPIDeposit = (options?: { initialTab?: 'fiat' | 'crypto'; allowFiatTab?: boolean }) => {
        setIsDepositChooserOpen(false);
        setIsManualDepositOpen(false);
        setManualDepositAllowBack(true);
        setDepositInitialTab(options?.initialTab ?? null);
        setDepositAllowFiatTab(options?.allowFiatTab ?? true);
        setIsDepositOpen(true);
    };
    const closeUPIDeposit = () => { setIsDepositOpen(false); resetDepositMode(); };

    const openManualDeposit = (options?: { allowBack?: boolean }) => {
        setIsDepositChooserOpen(false);
        setIsDepositOpen(false);
        setManualDepositAllowBack(options?.allowBack ?? true);
        setIsManualDepositOpen(true);
    };
    const closeManualDeposit = () => { setIsManualDepositOpen(false); setManualDepositAllowBack(true); resetDepositMode(); };

    const openWithdraw = () => { closeAll(); setIsWithdrawOpen(true); };
    const closeWithdraw = () => setIsWithdrawOpen(false);

    return (
        <ModalContext.Provider
            value={{
                isLoginOpen, openLogin, closeLogin,
                isRegisterOpen, openRegister, closeRegister,
                isDepositChooserOpen, openDeposit, closeDeposit,
                isDepositOpen, depositInitialTab, depositAllowFiatTab, openUPIDeposit, closeUPIDeposit,
                isManualDepositOpen, manualDepositAllowBack, openManualDeposit, closeManualDeposit,
                isWithdrawOpen, openWithdraw, closeWithdraw,
            }}
        >
            {children}
        </ModalContext.Provider>
    );
};

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error("useModal must be used within a ModalProvider");
    }
    return context;
};
