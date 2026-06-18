import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User, Receipt, Dices, Trophy, Activity, Wallet, History } from 'lucide-react';
import { createPortal } from 'react-dom';

interface UserPopupProps {
    userId?: number | string;
    username: string;
    email?: string | null;
    phoneNumber?: string | null;
}

export function UserPopup({ userId, username, email, phoneNumber }: UserPopupProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const openPopup = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX
            });
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                popupRef.current && 
                !popupRef.current.contains(e.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
            if (isOpen && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + window.scrollY + 8,
                    left: rect.left + window.scrollX
                });
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    return (
        <>
            <button
                ref={triggerRef}
                onClick={openPopup}
                className="text-white font-medium hover:text-indigo-400 hover:underline transition-colors flex items-center gap-1 group relative z-10"
                title="Click for quick actions"
            >
                {username}
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={popupRef}
                    style={{ top: coords.top, left: coords.left }}
                    className="absolute z-[9999] w-56 rounded-xl border border-slate-700 bg-slate-800 shadow-2xl py-2 flex flex-col animate-in fade-in slide-in-from-top-2"
                >
                    <div className="px-4 py-2 border-b border-slate-700 mb-1">
                        <p className="font-bold text-white truncate">{username}</p>
                        {email && <p className="text-xs text-slate-400 truncate">{email}</p>}
                        {(!email && phoneNumber) && <p className="text-xs text-slate-400 truncate">{phoneNumber}</p>}
                    </div>

                    <div className="flex flex-col px-2">
                        {userId && (
                            <Link 
                                href={`/dashboard/users/${userId}`} 
                                className="flex items-center gap-2 px-2 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                onClick={() => setIsOpen(false)}
                            >
                                <User size={16} className="text-indigo-400" /> View Profile
                            </Link>
                        )}
                        <Link 
                            href={`/dashboard/finance/transactions?search=${encodeURIComponent(username)}`} 
                            className="flex items-center gap-2 px-2 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <Receipt size={16} className="text-emerald-400" /> Transactions
                        </Link>
                        <Link 
                            href={`/dashboard/finance/deposits?search=${encodeURIComponent(username)}`} 
                            className="flex items-center gap-2 px-2 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <Wallet size={16} className="text-blue-400" /> Deposits
                        </Link>
                        <Link 
                            href={`/dashboard/finance/withdrawals?search=${encodeURIComponent(username)}`} 
                            className="flex items-center gap-2 px-2 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <History size={16} className="text-red-400" /> Withdrawals
                        </Link>
                        <Link 
                            href={`/dashboard/bets/casino?search=${encodeURIComponent(username)}`} 
                            className="flex items-center gap-2 px-2 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <Dices size={16} className="text-purple-400" /> Casino Bets
                        </Link>
                        <Link 
                            href={`/dashboard/sports/settlement?search=${encodeURIComponent(username)}`} 
                            className="flex items-center gap-2 px-2 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <Trophy size={16} className="text-amber-400" /> Sports Bets
                        </Link>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
