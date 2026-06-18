"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface Country {
    name: string;
    flag: string;
    code: string; // e.g. "+91"
    iso: string;  // e.g. "IN"
}

export const COUNTRIES: Country[] = [
    { name: "Afghanistan", flag: "🇦🇫", code: "+93", iso: "AF" },
    { name: "Albania", flag: "🇦🇱", code: "+355", iso: "AL" },
    { name: "Algeria", flag: "🇩🇿", code: "+213", iso: "DZ" },
    { name: "Andorra", flag: "🇦🇩", code: "+376", iso: "AD" },
    { name: "Angola", flag: "🇦🇴", code: "+244", iso: "AO" },
    { name: "Argentina", flag: "🇦🇷", code: "+54", iso: "AR" },
    { name: "Armenia", flag: "🇦🇲", code: "+374", iso: "AM" },
    { name: "Australia", flag: "🇦🇺", code: "+61", iso: "AU" },
    { name: "Austria", flag: "🇦🇹", code: "+43", iso: "AT" },
    { name: "Azerbaijan", flag: "🇦🇿", code: "+994", iso: "AZ" },
    { name: "Bahamas", flag: "🇧🇸", code: "+1-242", iso: "BS" },
    { name: "Bahrain", flag: "🇧🇭", code: "+973", iso: "BH" },
    { name: "Bangladesh", flag: "🇧🇩", code: "+880", iso: "BD" },
    { name: "Belarus", flag: "🇧🇾", code: "+375", iso: "BY" },
    { name: "Belgium", flag: "🇧🇪", code: "+32", iso: "BE" },
    { name: "Belize", flag: "🇧🇿", code: "+501", iso: "BZ" },
    { name: "Benin", flag: "🇧🇯", code: "+229", iso: "BJ" },
    { name: "Bhutan", flag: "🇧🇹", code: "+975", iso: "BT" },
    { name: "Bolivia", flag: "🇧🇴", code: "+591", iso: "BO" },
    { name: "Bosnia & Herzegovina", flag: "🇧🇦", code: "+387", iso: "BA" },
    { name: "Botswana", flag: "🇧🇼", code: "+267", iso: "BW" },
    { name: "Brazil", flag: "🇧🇷", code: "+55", iso: "BR" },
    { name: "Brunei", flag: "🇧🇳", code: "+673", iso: "BN" },
    { name: "Bulgaria", flag: "🇧🇬", code: "+359", iso: "BG" },
    { name: "Burkina Faso", flag: "🇧🇫", code: "+226", iso: "BF" },
    { name: "Burundi", flag: "🇧🇮", code: "+257", iso: "BI" },
    { name: "Cambodia", flag: "🇰🇭", code: "+855", iso: "KH" },
    { name: "Cameroon", flag: "🇨🇲", code: "+237", iso: "CM" },
    { name: "Canada", flag: "🇨🇦", code: "+1", iso: "CA" },
    { name: "Cape Verde", flag: "🇨🇻", code: "+238", iso: "CV" },
    { name: "Central African Republic", flag: "🇨🇫", code: "+236", iso: "CF" },
    { name: "Chad", flag: "🇹🇩", code: "+235", iso: "TD" },
    { name: "Chile", flag: "🇨🇱", code: "+56", iso: "CL" },
    { name: "China", flag: "🇨🇳", code: "+86", iso: "CN" },
    { name: "Colombia", flag: "🇨🇴", code: "+57", iso: "CO" },
    { name: "Comoros", flag: "🇰🇲", code: "+269", iso: "KM" },
    { name: "Congo", flag: "🇨🇬", code: "+242", iso: "CG" },
    { name: "DR Congo", flag: "🇨🇩", code: "+243", iso: "CD" },
    { name: "Costa Rica", flag: "🇨🇷", code: "+506", iso: "CR" },
    { name: "Croatia", flag: "🇭🇷", code: "+385", iso: "HR" },
    { name: "Cuba", flag: "🇨🇺", code: "+53", iso: "CU" },
    { name: "Cyprus", flag: "🇨🇾", code: "+357", iso: "CY" },
    { name: "Czech Republic", flag: "🇨🇿", code: "+420", iso: "CZ" },
    { name: "Denmark", flag: "🇩🇰", code: "+45", iso: "DK" },
    { name: "Djibouti", flag: "🇩🇯", code: "+253", iso: "DJ" },
    { name: "Dominican Republic", flag: "🇩🇴", code: "+1-809", iso: "DO" },
    { name: "Ecuador", flag: "🇪🇨", code: "+593", iso: "EC" },
    { name: "Egypt", flag: "🇪🇬", code: "+20", iso: "EG" },
    { name: "El Salvador", flag: "🇸🇻", code: "+503", iso: "SV" },
    { name: "Equatorial Guinea", flag: "🇬🇶", code: "+240", iso: "GQ" },
    { name: "Eritrea", flag: "🇪🇷", code: "+291", iso: "ER" },
    { name: "Estonia", flag: "🇪🇪", code: "+372", iso: "EE" },
    { name: "Ethiopia", flag: "🇪🇹", code: "+251", iso: "ET" },
    { name: "Fiji", flag: "🇫🇯", code: "+679", iso: "FJ" },
    { name: "Finland", flag: "🇫🇮", code: "+358", iso: "FI" },
    { name: "France", flag: "🇫🇷", code: "+33", iso: "FR" },
    { name: "Gabon", flag: "🇬🇦", code: "+241", iso: "GA" },
    { name: "Gambia", flag: "🇬🇲", code: "+220", iso: "GM" },
    { name: "Georgia", flag: "🇬🇪", code: "+995", iso: "GE" },
    { name: "Germany", flag: "🇩🇪", code: "+49", iso: "DE" },
    { name: "Ghana", flag: "🇬🇭", code: "+233", iso: "GH" },
    { name: "Greece", flag: "🇬🇷", code: "+30", iso: "GR" },
    { name: "Guatemala", flag: "🇬🇹", code: "+502", iso: "GT" },
    { name: "Guinea", flag: "🇬🇳", code: "+224", iso: "GN" },
    { name: "Guinea-Bissau", flag: "🇬🇼", code: "+245", iso: "GW" },
    { name: "Guyana", flag: "🇬🇾", code: "+592", iso: "GY" },
    { name: "Haiti", flag: "🇭🇹", code: "+509", iso: "HT" },
    { name: "Honduras", flag: "🇭🇳", code: "+504", iso: "HN" },
    { name: "Hungary", flag: "🇭🇺", code: "+36", iso: "HU" },
    { name: "Iceland", flag: "🇮🇸", code: "+354", iso: "IS" },
    { name: "India", flag: "🇮🇳", code: "+91", iso: "IN" },
    { name: "Indonesia", flag: "🇮🇩", code: "+62", iso: "ID" },
    { name: "Iran", flag: "🇮🇷", code: "+98", iso: "IR" },
    { name: "Iraq", flag: "🇮🇶", code: "+964", iso: "IQ" },
    { name: "Ireland", flag: "🇮🇪", code: "+353", iso: "IE" },
    { name: "Israel", flag: "🇮🇱", code: "+972", iso: "IL" },
    { name: "Italy", flag: "🇮🇹", code: "+39", iso: "IT" },
    { name: "Jamaica", flag: "🇯🇲", code: "+1-876", iso: "JM" },
    { name: "Japan", flag: "🇯🇵", code: "+81", iso: "JP" },
    { name: "Jordan", flag: "🇯🇴", code: "+962", iso: "JO" },
    { name: "Kazakhstan", flag: "🇰🇿", code: "+7", iso: "KZ" },
    { name: "Kenya", flag: "🇰🇪", code: "+254", iso: "KE" },
    { name: "Kuwait", flag: "🇰🇼", code: "+965", iso: "KW" },
    { name: "Kyrgyzstan", flag: "🇰🇬", code: "+996", iso: "KG" },
    { name: "Laos", flag: "🇱🇦", code: "+856", iso: "LA" },
    { name: "Latvia", flag: "🇱🇻", code: "+371", iso: "LV" },
    { name: "Lebanon", flag: "🇱🇧", code: "+961", iso: "LB" },
    { name: "Lesotho", flag: "🇱🇸", code: "+266", iso: "LS" },
    { name: "Liberia", flag: "🇱🇷", code: "+231", iso: "LR" },
    { name: "Libya", flag: "🇱🇾", code: "+218", iso: "LY" },
    { name: "Liechtenstein", flag: "🇱🇮", code: "+423", iso: "LI" },
    { name: "Lithuania", flag: "🇱🇹", code: "+370", iso: "LT" },
    { name: "Luxembourg", flag: "🇱🇺", code: "+352", iso: "LU" },
    { name: "Madagascar", flag: "🇲🇬", code: "+261", iso: "MG" },
    { name: "Malawi", flag: "🇲🇼", code: "+265", iso: "MW" },
    { name: "Malaysia", flag: "🇲🇾", code: "+60", iso: "MY" },
    { name: "Maldives", flag: "🇲🇻", code: "+960", iso: "MV" },
    { name: "Mali", flag: "🇲🇱", code: "+223", iso: "ML" },
    { name: "Malta", flag: "🇲🇹", code: "+356", iso: "MT" },
    { name: "Mauritania", flag: "🇲🇷", code: "+222", iso: "MR" },
    { name: "Mauritius", flag: "🇲🇺", code: "+230", iso: "MU" },
    { name: "Mexico", flag: "🇲🇽", code: "+52", iso: "MX" },
    { name: "Moldova", flag: "🇲🇩", code: "+373", iso: "MD" },
    { name: "Monaco", flag: "🇲🇨", code: "+377", iso: "MC" },
    { name: "Mongolia", flag: "🇲🇳", code: "+976", iso: "MN" },
    { name: "Montenegro", flag: "🇲🇪", code: "+382", iso: "ME" },
    { name: "Morocco", flag: "🇲🇦", code: "+212", iso: "MA" },
    { name: "Mozambique", flag: "🇲🇿", code: "+258", iso: "MZ" },
    { name: "Myanmar", flag: "🇲🇲", code: "+95", iso: "MM" },
    { name: "Namibia", flag: "🇳🇦", code: "+264", iso: "NA" },
    { name: "Nepal", flag: "🇳🇵", code: "+977", iso: "NP" },
    { name: "Netherlands", flag: "🇳🇱", code: "+31", iso: "NL" },
    { name: "New Zealand", flag: "🇳🇿", code: "+64", iso: "NZ" },
    { name: "Nicaragua", flag: "🇳🇮", code: "+505", iso: "NI" },
    { name: "Niger", flag: "🇳🇪", code: "+227", iso: "NE" },
    { name: "Nigeria", flag: "🇳🇬", code: "+234", iso: "NG" },
    { name: "North Korea", flag: "🇰🇵", code: "+850", iso: "KP" },
    { name: "North Macedonia", flag: "🇲🇰", code: "+389", iso: "MK" },
    { name: "Norway", flag: "🇳🇴", code: "+47", iso: "NO" },
    { name: "Oman", flag: "🇴🇲", code: "+968", iso: "OM" },
    { name: "Pakistan", flag: "🇵🇰", code: "+92", iso: "PK" },
    { name: "Panama", flag: "🇵🇦", code: "+507", iso: "PA" },
    { name: "Papua New Guinea", flag: "🇵🇬", code: "+675", iso: "PG" },
    { name: "Paraguay", flag: "🇵🇾", code: "+595", iso: "PY" },
    { name: "Peru", flag: "🇵🇪", code: "+51", iso: "PE" },
    { name: "Philippines", flag: "🇵🇭", code: "+63", iso: "PH" },
    { name: "Poland", flag: "🇵🇱", code: "+48", iso: "PL" },
    { name: "Portugal", flag: "🇵🇹", code: "+351", iso: "PT" },
    { name: "Qatar", flag: "🇶🇦", code: "+974", iso: "QA" },
    { name: "Romania", flag: "🇷🇴", code: "+40", iso: "RO" },
    { name: "Russia", flag: "🇷🇺", code: "+7", iso: "RU" },
    { name: "Rwanda", flag: "🇷🇼", code: "+250", iso: "RW" },
    { name: "Saudi Arabia", flag: "🇸🇦", code: "+966", iso: "SA" },
    { name: "Senegal", flag: "🇸🇳", code: "+221", iso: "SN" },
    { name: "Serbia", flag: "🇷🇸", code: "+381", iso: "RS" },
    { name: "Sierra Leone", flag: "🇸🇱", code: "+232", iso: "SL" },
    { name: "Singapore", flag: "🇸🇬", code: "+65", iso: "SG" },
    { name: "Slovakia", flag: "🇸🇰", code: "+421", iso: "SK" },
    { name: "Slovenia", flag: "🇸🇮", code: "+386", iso: "SI" },
    { name: "Somalia", flag: "🇸🇴", code: "+252", iso: "SO" },
    { name: "South Africa", flag: "🇿🇦", code: "+27", iso: "ZA" },
    { name: "South Korea", flag: "🇰🇷", code: "+82", iso: "KR" },
    { name: "South Sudan", flag: "🇸🇸", code: "+211", iso: "SS" },
    { name: "Spain", flag: "🇪🇸", code: "+34", iso: "ES" },
    { name: "Sri Lanka", flag: "🇱🇰", code: "+94", iso: "LK" },
    { name: "Sudan", flag: "🇸🇩", code: "+249", iso: "SD" },
    { name: "Suriname", flag: "🇸🇷", code: "+597", iso: "SR" },
    { name: "Sweden", flag: "🇸🇪", code: "+46", iso: "SE" },
    { name: "Switzerland", flag: "🇨🇭", code: "+41", iso: "CH" },
    { name: "Syria", flag: "🇸🇾", code: "+963", iso: "SY" },
    { name: "Taiwan", flag: "🇹🇼", code: "+886", iso: "TW" },
    { name: "Tajikistan", flag: "🇹🇯", code: "+992", iso: "TJ" },
    { name: "Tanzania", flag: "🇹🇿", code: "+255", iso: "TZ" },
    { name: "Thailand", flag: "🇹🇭", code: "+66", iso: "TH" },
    { name: "Timor-Leste", flag: "🇹🇱", code: "+670", iso: "TL" },
    { name: "Togo", flag: "🇹🇬", code: "+228", iso: "TG" },
    { name: "Trinidad & Tobago", flag: "🇹🇹", code: "+1-868", iso: "TT" },
    { name: "Tunisia", flag: "🇹🇳", code: "+216", iso: "TN" },
    { name: "Turkey", flag: "🇹🇷", code: "+90", iso: "TR" },
    { name: "Turkmenistan", flag: "🇹🇲", code: "+993", iso: "TM" },
    { name: "Uganda", flag: "🇺🇬", code: "+256", iso: "UG" },
    { name: "Ukraine", flag: "🇺🇦", code: "+380", iso: "UA" },
    { name: "United Arab Emirates", flag: "🇦🇪", code: "+971", iso: "AE" },
    { name: "United Kingdom", flag: "🇬🇧", code: "+44", iso: "GB" },
    { name: "United States", flag: "🇺🇸", code: "+1", iso: "US" },
    { name: "Uruguay", flag: "🇺🇾", code: "+598", iso: "UY" },
    { name: "Uzbekistan", flag: "🇺🇿", code: "+998", iso: "UZ" },
    { name: "Venezuela", flag: "🇻🇪", code: "+58", iso: "VE" },
    { name: "Vietnam", flag: "🇻🇳", code: "+84", iso: "VN" },
    { name: "Yemen", flag: "🇾🇪", code: "+967", iso: "YE" },
    { name: "Zambia", flag: "🇿🇲", code: "+260", iso: "ZM" },
    { name: "Zimbabwe", flag: "🇿🇼", code: "+263", iso: "ZW" },
];

interface CountryCodeSelectorProps {
    value: Country;
    onChange: (country: Country) => void;
    className?: string;
}

const CountryCodeSelector: React.FC<CountryCodeSelectorProps> = ({ value, onChange, className = "" }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const filtered = COUNTRIES.filter(
        (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.code.includes(search)
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
                className="h-[50px] bg-bg-elevated border border-divider rounded-xl px-3 flex items-center gap-1.5 min-w-[90px] text-text-primary text-sm font-medium hover:border-brand-gold transition-all whitespace-nowrap"
            >
                <span className="text-lg leading-none">{value.flag}</span>
                <span className="text-text-secondary">{value.code}</span>
                <ChevronDown size={13} className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute top-[calc(100%+6px)] left-0 z-[200] w-[260px] bg-bg-elevated border border-divider rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Search */}
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-divider">
                        <Search size={14} className="text-text-muted shrink-0" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Search country or code..."
                            className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-muted"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* List */}
                    <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-3 text-text-muted text-sm text-center">No results</div>
                        ) : (
                            filtered.map((country) => (
                                <button
                                    key={country.iso}
                                    type="button"
                                    onClick={() => {
                                        onChange(country);
                                        setOpen(false);
                                        setSearch("");
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors hover:bg-bg-hover ${value.iso === country.iso ? "bg-brand-gold/10 text-brand-gold" : "text-text-primary"
                                        }`}
                                >
                                    <span className="text-base leading-none">{country.flag}</span>
                                    <span className="flex-1 truncate">{country.name}</span>
                                    <span className="text-text-muted font-medium shrink-0">{country.code}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CountryCodeSelector;
