"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LayoutContextType {
    isMobileSidebarOpen: boolean;
    toggleMobileSidebar: () => void;
    closeMobileSidebar: () => void;
    isIconRail: boolean;
    toggleIconRail: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isIconRail, setIsIconRail] = useState(false);

    const toggleMobileSidebar = () => {
        setIsMobileSidebarOpen(prev => !prev);
    };

    const closeMobileSidebar = () => {
        setIsMobileSidebarOpen(false);
    };

    const toggleIconRail = () => {
        setIsIconRail(prev => !prev);
    };

    return (
        <LayoutContext.Provider value={{ isMobileSidebarOpen, toggleMobileSidebar, closeMobileSidebar, isIconRail, toggleIconRail }}>
            {children}
        </LayoutContext.Provider>
    );
};

export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (context === undefined) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
};
