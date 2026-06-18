"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRIES, Country } from "./CountryCodeSelector";

interface CountrySelectorProps {
    value: string; // ISO code of the country
    onChange: (iso: string) => void;
    className?: string;
}

const CountrySelector: React.FC<CountrySelectorProps> = ({ value, onChange, className = "" }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const selectedCountry = COUNTRIES.find((c) => c.iso === value) || null;

    const filtered = COUNTRIES.filter(
        (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.iso.toLowerCase().includes(search.toLowerCase())
    );

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Focus search when opened
    useEffect(() => {
        if (open && searchRef.current) {
            setTimeout(() => searchRef.current?.focus(), 50);
        }
    }, [open]);

    return (
        <div ref={ref} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => { setOpen(!open); setSearch(""); }}
                className={`w-full h-[42px] bg-bg-deep-4 border rounded-xl px-4 flex items-center justify-between text-sm font-medium transition-all ${open ? "border-brand-gold/60 ring-[1.5px] ring-brand-gold/40" : "border-white/[0.06] hover:border-white/[0.12]"} ${selectedCountry ? "text-white" : "text-white/20"}`}
            >
                {selectedCountry ? (
                    <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">{selectedCountry.flag}</span>
                        <span className="truncate">{selectedCountry.name}</span>
                    </div>
                ) : (
                    "Select Country"
                )}
                <ChevronDown size={14} className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute top-[calc(100%+6px)] left-0 z-[200] w-full bg-bg-deep-4 border border-white/[0.06] rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Search */}
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.04] bg-white/[0.02]">
                        <Search size={14} className="text-white/40 shrink-0" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Search country..."
                            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* List */}
                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-3 text-white/40 text-sm text-center">No results</div>
                        ) : (
                            filtered.map((country) => (
                                <button
                                    key={country.iso}
                                    type="button"
                                    onClick={() => {
                                        onChange(country.iso);
                                        setOpen(false);
                                        setSearch("");
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors hover:bg-white/[0.05] ${value === country.iso ? "bg-brand-gold/10 text-brand-gold" : "text-white"
                                        }`}
                                >
                                    <span className="text-base leading-none w-5 text-center">{country.flag}</span>
                                    <span className="flex-1 truncate">{country.name}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CountrySelector;
