"use client";

import React, { useState } from "react";
import { User, X, Check, Trophy, Smartphone, Mail, Eye, EyeOff, AlertCircle, Lock, Gift, Sparkles, ChevronDown, Search, Globe, ShieldCheck, Loader2 } from "lucide-react";
import api from "@/services/api";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import CountryCodeSelector, { Country, COUNTRIES } from "@/components/shared/CountryCodeSelector";
import { getCurrencySymbol } from "@/utils/currency";
import { getStoredUtm, clearStoredUtm } from "@/lib/utm";

interface RegisterModalProps {
    onClose?: () => void;
    onLoginClick?: () => void;
}

// Map ISO-2 → currency code for all 195 countries
const COUNTRY_CURRENCY_MAP: Record<string, { currency: string; name: string; flag: string }> = {
    AF: { currency: 'AFN', name: 'Afghanistan', flag: '🇦🇫' }, AL: { currency: 'ALL', name: 'Albania', flag: '🇦🇱' }, DZ: { currency: 'DZD', name: 'Algeria', flag: '🇩🇿' },
    AD: { currency: 'EUR', name: 'Andorra', flag: '🇦🇩' }, AO: { currency: 'AOA', name: 'Angola', flag: '🇦🇴' }, AG: { currency: 'XCD', name: 'Antigua & Barbuda', flag: '🇦🇬' },
    AR: { currency: 'ARS', name: 'Argentina', flag: '🇦🇷' }, AM: { currency: 'AMD', name: 'Armenia', flag: '🇦🇲' }, AU: { currency: 'AUD', name: 'Australia', flag: '🇦🇺' },
    AT: { currency: 'EUR', name: 'Austria', flag: '🇦🇹' }, AZ: { currency: 'AZN', name: 'Azerbaijan', flag: '🇦🇿' }, BS: { currency: 'BSD', name: 'Bahamas', flag: '🇧🇸' },
    BH: { currency: 'BHD', name: 'Bahrain', flag: '🇧🇭' }, BD: { currency: 'BDT', name: 'Bangladesh', flag: '🇧🇩' }, BB: { currency: 'BBD', name: 'Barbados', flag: '🇧🇧' },
    BY: { currency: 'BYN', name: 'Belarus', flag: '🇧🇾' }, BE: { currency: 'EUR', name: 'Belgium', flag: '🇧🇪' }, BZ: { currency: 'BZD', name: 'Belize', flag: '🇧🇿' },
    BJ: { currency: 'XOF', name: 'Benin', flag: '🇧🇯' }, BT: { currency: 'BTN', name: 'Bhutan', flag: '🇧🇹' }, BO: { currency: 'BOB', name: 'Bolivia', flag: '🇧🇴' },
    BA: { currency: 'BAM', name: 'Bosnia & Herzegovina', flag: '🇧🇦' }, BW: { currency: 'BWP', name: 'Botswana', flag: '🇧🇼' }, BR: { currency: 'BRL', name: 'Brazil', flag: '🇧🇷' },
    BN: { currency: 'BND', name: 'Brunei', flag: '🇧🇳' }, BG: { currency: 'BGN', name: 'Bulgaria', flag: '🇧🇬' }, BF: { currency: 'XOF', name: 'Burkina Faso', flag: '🇧🇫' },
    BI: { currency: 'BIF', name: 'Burundi', flag: '🇧🇮' }, CV: { currency: 'CVE', name: 'Cabo Verde', flag: '🇨🇻' }, KH: { currency: 'KHR', name: 'Cambodia', flag: '🇰🇭' },
    CM: { currency: 'XAF', name: 'Cameroon', flag: '🇨🇲' }, CA: { currency: 'CAD', name: 'Canada', flag: '🇨🇦' }, CF: { currency: 'XAF', name: 'Central African Rep.', flag: '🇨🇫' },
    TD: { currency: 'XAF', name: 'Chad', flag: '🇹🇩' }, CL: { currency: 'CLP', name: 'Chile', flag: '🇨🇱' }, CN: { currency: 'CNY', name: 'China', flag: '🇨🇳' },
    CO: { currency: 'COP', name: 'Colombia', flag: '🇨🇴' }, KM: { currency: 'KMF', name: 'Comoros', flag: '🇰🇲' }, CD: { currency: 'CDF', name: 'Congo (DR)', flag: '🇨🇩' },
    CG: { currency: 'XAF', name: 'Congo (Rep.)', flag: '🇨🇬' }, CR: { currency: 'CRC', name: 'Costa Rica', flag: '🇨🇷' }, HR: { currency: 'EUR', name: 'Croatia', flag: '🇭🇷' },
    CU: { currency: 'CUP', name: 'Cuba', flag: '🇨🇺' }, CY: { currency: 'EUR', name: 'Cyprus', flag: '🇨🇾' }, CZ: { currency: 'CZK', name: 'Czech Republic', flag: '🇨🇿' },
    DK: { currency: 'DKK', name: 'Denmark', flag: '🇩🇰' }, DJ: { currency: 'DJF', name: 'Djibouti', flag: '🇩🇯' }, DM: { currency: 'XCD', name: 'Dominica', flag: '🇩🇲' },
    DO: { currency: 'DOP', name: 'Dominican Republic', flag: '🇩🇴' }, TL: { currency: 'USD', name: 'East Timor', flag: '🇹🇱' }, EC: { currency: 'USD', name: 'Ecuador', flag: '🇪🇨' },
    EG: { currency: 'EGP', name: 'Egypt', flag: '🇪🇬' }, SV: { currency: 'USD', name: 'El Salvador', flag: '🇸🇻' }, GQ: { currency: 'XAF', name: 'Equatorial Guinea', flag: '🇬🇶' },
    ER: { currency: 'ERN', name: 'Eritrea', flag: '🇪🇷' }, EE: { currency: 'EUR', name: 'Estonia', flag: '🇪🇪' }, SZ: { currency: 'SZL', name: 'Eswatini', flag: '🇸🇿' },
    ET: { currency: 'ETB', name: 'Ethiopia', flag: '🇪🇹' }, FJ: { currency: 'FJD', name: 'Fiji', flag: '🇫🇯' }, FI: { currency: 'EUR', name: 'Finland', flag: '🇫🇮' },
    FR: { currency: 'EUR', name: 'France', flag: '🇫🇷' }, GA: { currency: 'XAF', name: 'Gabon', flag: '🇬🇦' }, GM: { currency: 'GMD', name: 'Gambia', flag: '🇬🇲' },
    GE: { currency: 'GEL', name: 'Georgia', flag: '🇬🇪' }, DE: { currency: 'EUR', name: 'Germany', flag: '🇩🇪' }, GH: { currency: 'GHS', name: 'Ghana', flag: '🇬🇭' },
    GR: { currency: 'EUR', name: 'Greece', flag: '🇬🇷' }, GD: { currency: 'XCD', name: 'Grenada', flag: '🇬🇩' }, GT: { currency: 'GTQ', name: 'Guatemala', flag: '🇬🇹' },
    GN: { currency: 'GNF', name: 'Guinea', flag: '🇬🇳' }, GW: { currency: 'XOF', name: 'Guinea-Bissau', flag: '🇬🇼' }, GY: { currency: 'GYD', name: 'Guyana', flag: '🇬🇾' },
    HT: { currency: 'HTG', name: 'Haiti', flag: '🇭🇹' }, HN: { currency: 'HNL', name: 'Honduras', flag: '🇭🇳' }, HU: { currency: 'HUF', name: 'Hungary', flag: '🇭🇺' },
    IS: { currency: 'ISK', name: 'Iceland', flag: '🇮🇸' }, IN: { currency: 'USD', name: 'India', flag: '🇮🇳' }, ID: { currency: 'IDR', name: 'Indonesia', flag: '🇮🇩' },
    IR: { currency: 'IRR', name: 'Iran', flag: '🇮🇷' }, IQ: { currency: 'IQD', name: 'Iraq', flag: '🇮🇶' }, IE: { currency: 'EUR', name: 'Ireland', flag: '🇮🇪' },
    IL: { currency: 'ILS', name: 'Israel', flag: '🇮🇱' }, IT: { currency: 'EUR', name: 'Italy', flag: '🇮🇹' }, JM: { currency: 'JMD', name: 'Jamaica', flag: '🇯🇲' },
    JP: { currency: 'JPY', name: 'Japan', flag: '🇯🇵' }, JO: { currency: 'JOD', name: 'Jordan', flag: '🇯🇴' }, KZ: { currency: 'KZT', name: 'Kazakhstan', flag: '🇰🇿' },
    KE: { currency: 'KES', name: 'Kenya', flag: '🇰🇪' }, KI: { currency: 'AUD', name: 'Kiribati', flag: '🇰🇮' }, KW: { currency: 'KWD', name: 'Kuwait', flag: '🇰🇼' },
    KG: { currency: 'KGS', name: 'Kyrgyzstan', flag: '🇰🇬' }, LA: { currency: 'LAK', name: 'Laos', flag: '🇱🇦' }, LV: { currency: 'EUR', name: 'Latvia', flag: '🇱🇻' },
    LB: { currency: 'LBP', name: 'Lebanon', flag: '🇱🇧' }, LS: { currency: 'LSL', name: 'Lesotho', flag: '🇱🇸' }, LR: { currency: 'LRD', name: 'Liberia', flag: '🇱🇷' },
    LY: { currency: 'LYD', name: 'Libya', flag: '🇱🇾' }, LI: { currency: 'CHF', name: 'Liechtenstein', flag: '🇱🇮' }, LT: { currency: 'EUR', name: 'Lithuania', flag: '🇱🇹' },
    LU: { currency: 'EUR', name: 'Luxembourg', flag: '🇱🇺' }, MG: { currency: 'MGA', name: 'Madagascar', flag: '🇲🇬' }, MW: { currency: 'MWK', name: 'Malawi', flag: '🇲🇼' },
    MY: { currency: 'MYR', name: 'Malaysia', flag: '🇲🇾' }, MV: { currency: 'MVR', name: 'Maldives', flag: '🇲🇻' }, ML: { currency: 'XOF', name: 'Mali', flag: '🇲🇱' },
    MT: { currency: 'EUR', name: 'Malta', flag: '🇲🇹' }, MH: { currency: 'USD', name: 'Marshall Islands', flag: '🇲🇭' }, MR: { currency: 'MRU', name: 'Mauritania', flag: '🇲🇷' },
    MU: { currency: 'MUR', name: 'Mauritius', flag: '🇲🇺' }, MX: { currency: 'MXN', name: 'Mexico', flag: '🇲🇽' }, FM: { currency: 'USD', name: 'Micronesia', flag: '🇫🇲' },
    MD: { currency: 'MDL', name: 'Moldova', flag: '🇲🇩' }, MC: { currency: 'EUR', name: 'Monaco', flag: '🇲🇨' }, MN: { currency: 'MNT', name: 'Mongolia', flag: '🇲🇳' },
    ME: { currency: 'EUR', name: 'Montenegro', flag: '🇲🇪' }, MA: { currency: 'MAD', name: 'Morocco', flag: '🇲🇦' }, MZ: { currency: 'MZN', name: 'Mozambique', flag: '🇲🇿' },
    MM: { currency: 'MMK', name: 'Myanmar', flag: '🇲🇲' }, NA: { currency: 'NAD', name: 'Namibia', flag: '🇳🇦' }, NR: { currency: 'AUD', name: 'Nauru', flag: '🇳🇷' },
    NP: { currency: 'NPR', name: 'Nepal', flag: '🇳🇵' }, NL: { currency: 'EUR', name: 'Netherlands', flag: '🇳🇱' }, NZ: { currency: 'NZD', name: 'New Zealand', flag: '🇳🇿' },
    NI: { currency: 'NIO', name: 'Nicaragua', flag: '🇳🇮' }, NE: { currency: 'XOF', name: 'Niger', flag: '🇳🇪' }, NG: { currency: 'NGN', name: 'Nigeria', flag: '🇳🇬' },
    KP: { currency: 'KPW', name: 'North Korea', flag: '🇰🇵' }, MK: { currency: 'MKD', name: 'North Macedonia', flag: '🇲🇰' }, NO: { currency: 'NOK', name: 'Norway', flag: '🇳🇴' },
    OM: { currency: 'OMR', name: 'Oman', flag: '🇴🇲' }, PK: { currency: 'PKR', name: 'Pakistan', flag: '🇵🇰' }, PW: { currency: 'USD', name: 'Palau', flag: '🇵🇼' },
    PS: { currency: 'ILS', name: 'Palestine', flag: '🇵🇸' }, PA: { currency: 'PAB', name: 'Panama', flag: '🇵🇦' }, PG: { currency: 'PGK', name: 'Papua New Guinea', flag: '🇵🇬' },
    PY: { currency: 'PYG', name: 'Paraguay', flag: '🇵🇾' }, PE: { currency: 'PEN', name: 'Peru', flag: '🇵🇪' }, PH: { currency: 'PHP', name: 'Philippines', flag: '🇵🇭' },
    PL: { currency: 'PLN', name: 'Poland', flag: '🇵🇱' }, PT: { currency: 'EUR', name: 'Portugal', flag: '🇵🇹' }, QA: { currency: 'QAR', name: 'Qatar', flag: '🇶🇦' },
    RO: { currency: 'RON', name: 'Romania', flag: '🇷🇴' }, RU: { currency: 'RUB', name: 'Russia', flag: '🇷🇺' }, RW: { currency: 'RWF', name: 'Rwanda', flag: '🇷🇼' },
    KN: { currency: 'XCD', name: 'Saint Kitts & Nevis', flag: '🇰🇳' }, LC: { currency: 'XCD', name: 'Saint Lucia', flag: '🇱🇨' }, VC: { currency: 'XCD', name: 'Saint Vincent', flag: '🇻🇨' },
    WS: { currency: 'WST', name: 'Samoa', flag: '🇼🇸' }, SM: { currency: 'EUR', name: 'San Marino', flag: '🇸🇲' }, ST: { currency: 'STN', name: 'Sao Tome & Principe', flag: '🇸🇹' },
    SA: { currency: 'SAR', name: 'Saudi Arabia', flag: '🇸🇦' }, SN: { currency: 'XOF', name: 'Senegal', flag: '🇸🇳' }, RS: { currency: 'RSD', name: 'Serbia', flag: '🇷🇸' },
    SC: { currency: 'SCR', name: 'Seychelles', flag: '🇸🇨' }, SL: { currency: 'SLL', name: 'Sierra Leone', flag: '🇸🇱' }, SG: { currency: 'SGD', name: 'Singapore', flag: '🇸🇬' },
    SK: { currency: 'EUR', name: 'Slovakia', flag: '🇸🇰' }, SI: { currency: 'EUR', name: 'Slovenia', flag: '🇸🇮' }, SB: { currency: 'SBD', name: 'Solomon Islands', flag: '🇸🇧' },
    SO: { currency: 'SOS', name: 'Somalia', flag: '🇸🇴' }, ZA: { currency: 'ZAR', name: 'South Africa', flag: '🇿🇦' }, KR: { currency: 'KRW', name: 'South Korea', flag: '🇰🇷' },
    SS: { currency: 'SSP', name: 'South Sudan', flag: '🇸🇸' }, ES: { currency: 'EUR', name: 'Spain', flag: '🇪🇸' }, LK: { currency: 'LKR', name: 'Sri Lanka', flag: '🇱🇰' },
    SD: { currency: 'SDG', name: 'Sudan', flag: '🇸🇩' }, SR: { currency: 'SRD', name: 'Suriname', flag: '🇸🇷' }, SE: { currency: 'SEK', name: 'Sweden', flag: '🇸🇪' },
    CH: { currency: 'CHF', name: 'Switzerland', flag: '🇨🇭' }, SY: { currency: 'SYP', name: 'Syria', flag: '🇸🇾' }, TW: { currency: 'TWD', name: 'Taiwan', flag: '🇹🇼' },
    TJ: { currency: 'TJS', name: 'Tajikistan', flag: '🇹🇯' }, TZ: { currency: 'TZS', name: 'Tanzania', flag: '🇹🇿' }, TH: { currency: 'THB', name: 'Thailand', flag: '🇹🇭' },
    TG: { currency: 'XOF', name: 'Togo', flag: '🇹🇬' }, TO: { currency: 'TOP', name: 'Tonga', flag: '🇹🇴' }, TT: { currency: 'TTD', name: 'Trinidad & Tobago', flag: '🇹🇹' },
    TN: { currency: 'TND', name: 'Tunisia', flag: '🇹🇳' }, TR: { currency: 'TRY', name: 'Turkey', flag: '🇹🇷' }, TM: { currency: 'TMT', name: 'Turkmenistan', flag: '🇹🇲' },
    TV: { currency: 'AUD', name: 'Tuvalu', flag: '🇹🇻' }, UG: { currency: 'UGX', name: 'Uganda', flag: '🇺🇬' }, UA: { currency: 'UAH', name: 'Ukraine', flag: '🇺🇦' },
    AE: { currency: 'AED', name: 'United Arab Emirates', flag: '🇦🇪' }, GB: { currency: 'GBP', name: 'United Kingdom', flag: '🇬🇧' }, US: { currency: 'USD', name: 'United States', flag: '🇺🇸' },
    UY: { currency: 'UYU', name: 'Uruguay', flag: '🇺🇾' }, UZ: { currency: 'UZS', name: 'Uzbekistan', flag: '🇺🇿' }, VU: { currency: 'VUV', name: 'Vanuatu', flag: '🇻🇺' },
    VE: { currency: 'VES', name: 'Venezuela', flag: '🇻🇪' }, VN: { currency: 'VND', name: 'Vietnam', flag: '🇻🇳' }, YE: { currency: 'YER', name: 'Yemen', flag: '🇾🇪' },
    ZM: { currency: 'ZMW', name: 'Zambia', flag: '🇿🇲' }, ZW: { currency: 'USD', name: 'Zimbabwe', flag: '🇿🇼' },
};

const ALL_COUNTRIES = Object.entries(COUNTRY_CURRENCY_MAP)
    .map(([iso, v]) => ({ iso, ...v }))
    .sort((a, b) => a.name.localeCompare(b.name));

const RegisterModal: React.FC<RegisterModalProps> = ({ onClose, onLoginClick }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        phoneNumber: '',
        password: '',
        confirmPassword: '',
        currency: 'USD',
        promoCode: '',
    });
    const [referralCode, setReferralCode] = useState(''); // from ?ref= URL, kept separate from promoCode
    const [isPhone, setIsPhone] = useState(true);
    const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES.find(c => c.iso === 'IN')!);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(true);
    const [hasPromo, setHasPromo] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
    // Registration country — required, null until user picks
    const [registrationCountry, setRegistrationCountry] = useState<string | null>(null);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');

    // OTP step (phone AND email registration)
    type RegStep = 'form' | 'verify_otp';
    const [regStep, setRegStep] = useState<RegStep>('form');
    const [otpCode, setOtpCode] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendLoading, setResendLoading] = useState(false);
    const [otpExpiresIn, setOtpExpiresIn] = useState(0);

    // Welcome bonus state
    const [signupBonuses, setSignupBonuses] = useState<any[]>([]);
    const [selectedBonusCode, setSelectedBonusCode] = useState<string | null>(null); // null = no bonus

    const { login } = useAuth();

    // Resend cooldown timer
    React.useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    // OTP expiry countdown timer
    React.useEffect(() => {
        if (otpExpiresIn <= 0) return;
        const t = setTimeout(() => setOtpExpiresIn(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [otpExpiresIn]);

    const handleResendOtp = async () => {
        setError('');
        setResendLoading(true);
        try {
            if (isPhone) {
                const fullPhone = `${selectedCountry.code.replace(/-/g, '')}${formData.phoneNumber.trim()}`;
                await api.post('/auth/send-otp', {
                    phoneNumber: fullPhone.startsWith('+') ? fullPhone : `+${fullPhone}`,
                    purpose: 'REGISTER',
                });
            } else {
                await api.post('/auth/send-email-otp', {
                    email: formData.email.trim(),
                    purpose: 'REGISTER',
                });
            }
            setResendCooldown(60);
            setOtpExpiresIn(isPhone ? 120 : 600);
            setOtpCode('');
            toast.success('OTP resent successfully!');
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(typeof msg === 'string' ? msg : 'Failed to resend OTP. Please try again.');
        } finally {
            setResendLoading(false);
        }
    };

    // Pre-fill referral code from localStorage — keep SEPARATE from promoCode
    React.useEffect(() => {
        const storedRefCode = localStorage.getItem('referralCode');
        if (storedRefCode) {
            setReferralCode(storedRefCode.trim().toUpperCase());
        }
        // Fetch available signup bonuses
        api.get('/bonus/signup-options')
            .then(res => setSignupBonuses(res.data || []))
            .catch(() => { }); // fail silently
    }, []);

    const handleTabChange = (phone: boolean) => {
        setIsPhone(phone);
        setFieldErrors({});
        setError('');
    };

    const handleRegistrationCountrySelect = (iso: string) => {
        const info = COUNTRY_CURRENCY_MAP[iso];
        if (!info) return;
        setRegistrationCountry(iso);
        setFormData(prev => ({ ...prev, currency: info.currency }));
        // Also sync the phone dial-code selector to match
        const phoneCountry = COUNTRIES.find(c => c.iso === iso);
        if (phoneCountry) setSelectedCountry(phoneCountry);
        setShowCountryDropdown(false);
        setCountrySearch('');
        setFieldErrors(prev => ({ ...prev, registrationCountry: '' }));
    };

    const filteredCountries = ALL_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.iso.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.currency.toLowerCase().includes(countrySearch.toLowerCase())
    );

    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};

        if (!registrationCountry) {
            newErrors.registrationCountry = 'Please select your country';
        }

        if (isPhone) {
            const phone = formData.phoneNumber.trim().replace(/\s/g, '');
            if (!phone) {
                newErrors.phoneNumber = 'Phone number is required';
            } else if (!/^\d{10,15}$/.test(phone)) {
                newErrors.phoneNumber = 'Enter a valid phone number (10–15 digits)';
            }
        } else {
            const emailVal = formData.email.trim();
            if (!emailVal) {
                newErrors.email = 'Email is required';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
                newErrors.email = 'Please enter a valid email address';
            }
        }

        const usernameVal = formData.username.trim();
        if (usernameVal) {
            if (!/^[a-zA-Z0-9_]{3,15}$/.test(usernameVal)) {
                newErrors.username = 'Username must be 3-15 chars (letters, numbers, underscores)';
            }
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (!/[A-Za-z]/.test(formData.password) || !/\d/.test(formData.password)) {
            newErrors.password = 'Password must contain letters and numbers';
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setFieldErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        setError('');
        if (!validateForm()) return;
        if (!termsAccepted) {
            setError('Please accept the terms and conditions');
            return;
        }

        // ── Send OTP first (both phone and email) ─────────────────────────
        if (regStep === 'form') {
            setLoading(true);
            try {
                if (isPhone) {
                    const fullPhone = `${selectedCountry.code.replace(/-/g, '')}${formData.phoneNumber.trim()}`;
                    await api.post('/auth/send-otp', {
                        phoneNumber: fullPhone.startsWith('+') ? fullPhone : `+${fullPhone}`,
                        purpose: 'REGISTER',
                    });
                } else {
                    await api.post('/auth/send-email-otp', {
                        email: formData.email.trim(),
                        purpose: 'REGISTER',
                    });
                }
                setRegStep('verify_otp');
                setOtpCode('');
                setResendCooldown(60);
                setOtpExpiresIn(isPhone ? 120 : 600); // phone: 2min, email: 10min
            } catch (err: any) {
                const msg = err.response?.data?.message;
                setError(typeof msg === 'string' ? msg : 'Failed to send OTP. Please try again.');
            } finally {
                setLoading(false);
            }
            return;
        }
    };

    // ── Verify OTP then finalize registration ─────────────────────────────────
    const handleVerifyOtpAndRegister = async () => {
        setError('');
        if (otpCode.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
        setOtpLoading(true);
        try {
            // 1. Verify OTP (phone or email)
            if (isPhone) {
                const fullPhone = `${selectedCountry.code.replace(/-/g, '')}${formData.phoneNumber.trim()}`;
                const phoneNumber = fullPhone.startsWith('+') ? fullPhone : `+${fullPhone}`;
                await api.post('/auth/verify-otp', { phoneNumber, code: otpCode, purpose: 'REGISTER' });
            } else {
                await api.post('/auth/verify-email-otp', { email: formData.email.trim(), code: otpCode, purpose: 'REGISTER' });
            }
            // 2. Proceed with signup
            const utmData = getStoredUtm();
            const fullPhone = isPhone ? `${selectedCountry.code.replace(/-/g, '')}${formData.phoneNumber.trim()}` : '';
            const phoneNumber = fullPhone.startsWith('+') ? fullPhone : `+${fullPhone}`;
            const payload = {
                ...(isPhone ? { phoneNumber } : { email: formData.email.trim() }),
                password: formData.password,
                ...(formData.username.trim() ? { username: formData.username.trim() } : {}),
                currency: formData.currency || 'USD',
                country: registrationCountry,
                ...(formData.promoCode.trim() ? { promoCode: formData.promoCode.trim().toUpperCase() } : {}),
                ...(referralCode ? { referralCode } : {}),
                ...(utmData?.utm_source ? { utm_source: utmData.utm_source } : {}),
                ...(utmData?.utm_medium ? { utm_medium: utmData.utm_medium } : {}),
                ...(utmData?.utm_campaign ? { utm_campaign: utmData.utm_campaign } : {}),
                ...(utmData?.utm_content ? { utm_content: utmData.utm_content } : {}),
                ...(utmData?.utm_term ? { utm_term: utmData.utm_term } : {}),
                ...(utmData?.referrerUrl ? { referrerUrl: utmData.referrerUrl } : {}),
                ...(utmData?.landingPage ? { landingPage: utmData.landingPage } : {}),
            };
            const res = await api.post('/auth/signup', payload);
            login(res.data.access_token, res.data.user);
            // Bonus
            if (selectedBonusCode) {
                const selectedBonus = signupBonuses.find((b: any) => b.code === selectedBonusCode);
                if (selectedBonus) {
                    if (!selectedBonus.forFirstDepositOnly) {
                        try { await api.post('/bonus/redeem-signup', { bonusCode: selectedBonusCode }, { headers: { Authorization: `Bearer ${res.data.access_token}` } }); } catch { }
                    } else {
                        try { await api.post('/bonus/pending', { bonusCode: selectedBonusCode }, { headers: { Authorization: `Bearer ${res.data.access_token}` } }); } catch { }
                    }
                }
            }
            if (referralCode) localStorage.removeItem('referralCode');
            clearStoredUtm();
            toast.success('Registration successful! Welcome to ODD69.');
            if (onClose) onClose();
            // Show deposit prompt after successful signup
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('show-signup-deposit-prompt'));
            }, 500);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(typeof msg === 'string' ? msg : 'Verification failed. Please try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            {/*
              Mobile: bottom sheet — fills width, max 90vh, flex-col with sticky footer
              Desktop: centered card — max 860px wide, two-column layout
            */}
            <div className="relative w-full md:max-w-[860px] md:max-h-[92vh] bg-auth-base rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col md:flex-row border border-divider overflow-hidden"
                style={{ maxHeight: '92dvh', transformOrigin: 'center' }}>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-bg-elevated hover:bg-bg-hover transition-transform duration-200 ease-out active:scale-[0.97] text-text-muted hover:text-text-primary"
                >
                    <X size={18} />
                </button>

                {/* Left Column: Banner — desktop only */}
                <div className="hidden md:flex flex-col w-[38%] bg-bg-elevated relative items-center justify-center p-8 text-center border-r border-divider flex-shrink-0">
                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="w-32 h-32 rounded-full bg-bg-base flex items-center justify-center border border-divider">
                            <Trophy size={64} className="text-brand-gold opacity-60" />
                        </div>
                        <div className="text-4xl font-extrabold italic tracking-tight mt-2">
                            <span className="text-brand-gold">ODD</span>69
                        </div>
                        <h2 className="text-3xl font-black text-text-primary italic uppercase tracking-tighter">
                            JOIN NOW
                        </h2>
                        <p className="text-text-muted text-sm leading-relaxed max-w-[180px]">
                            The best sportsbook &amp; casino experience awaits you
                        </p>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none rounded-l-2xl" />
                </div>

                {/* Right Column: Form — full width on mobile, flex-1 on desktop */}
                {/* CRITICAL: flex-col with overflow-hidden so we can scroll inside */}
                <div className="flex-1 flex flex-col min-h-0 bg-auth-base overflow-hidden">

                    {/* ── Non-scrolling header ── */}
                    <div className="flex-shrink-0 px-6 pt-6 pb-0 md:px-10 md:pt-10">
                        {/* Mobile drag handle */}
                        <div className="md:hidden w-10 h-1 bg-white/[0.16] rounded-full mx-auto mb-4" />

                        {/* Mobile logo */}
                        <div className="md:hidden text-center mb-4">
                            <span className="text-3xl font-black italic tracking-tight">
                                <span className="text-brand-gold">ODD</span><span className="text-white">69</span>
                            </span>
                            <p className="text-xs text-white/35 mt-1 font-medium tracking-wide">SPORTS · CASINO · ORIGINALS</p>
                        </div>

                        <h3 className="font-poppins text-text-primary text-xl font-extrabold uppercase tracking-wide mb-0.5">
                            Create Account
                        </h3>
                        <p className="text-sm text-text-muted mb-4">
                            Already have an account?{' '}
                            <button onClick={onLoginClick} className="text-brand-gold font-bold hover:underline">
                                Log In
                            </button>
                        </p>
                    </div>

                    {/* ── Scrollable body ── */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-6 pb-2 md:px-10">

                    {/* Form fields — hidden during OTP step */}
                    {regStep === 'verify_otp' ? (
                        <div className="flex flex-col gap-5 pb-4">
                            {/* OTP Screen */}
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center mx-auto mb-3">
                                    <ShieldCheck size={30} className="text-brand-gold" />
                                </div>
                                <h4 className="text-text-primary font-bold text-lg">{isPhone ? 'Verify Your Number' : 'Verify Your Email'}</h4>
                                <p className="text-text-muted text-sm mt-1">
                                    Enter the 6-digit OTP sent to{' '}
                                    {isPhone ? (
                                        <strong className="text-text-primary">+{selectedCountry.code.replace(/-/g, '').replace('+', '')}{formData.phoneNumber}</strong>
                                    ) : (
                                        <strong className="text-text-primary">{formData.email}</strong>
                                    )}
                                </p>
                            </div>
                            <div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="— — — — — —"
                                    value={otpCode}
                                    onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                                    className={`w-full h-[60px] bg-bg-elevated border-2 rounded-xl px-4 text-text-primary text-[28px] font-bold tracking-[0.5em] text-center outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted placeholder:text-2xl placeholder:tracking-[0.3em] ${error ? 'border-red-500' : 'border-divider focus:border-brand-gold focus:ring-brand-gold/40'}`}
                                />
                                {error && <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
                            </div>
                        </div>
                    ) : (
                    <div className="flex flex-col gap-4 pb-4">

                        {/* Country Selector (required) — FIRST */}
                        <div>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => { setShowCountryDropdown(!showCountryDropdown); setCountrySearch(''); }}
                                    className={`w-full h-[50px] bg-bg-elevated border rounded-xl px-4 flex items-center gap-3 text-left transition-all ${fieldErrors.registrationCountry
                                        ? 'border-red-500'
                                        : registrationCountry
                                            ? 'border-divider hover:border-brand-gold/50'
                                            : 'border-dashed border-brand-gold/40 hover:border-brand-gold'
                                        }`}
                                >
                                    <Globe size={16} className="text-text-muted shrink-0" />
                                    {registrationCountry ? (
                                        <>
                                            <span className="text-lg leading-none">{COUNTRY_CURRENCY_MAP[registrationCountry]?.flag}</span>
                                            <span className="flex-1 font-semibold text-text-primary text-sm">{COUNTRY_CURRENCY_MAP[registrationCountry]?.name}</span>
                                            <span className="text-xs text-text-muted font-mono">{COUNTRY_CURRENCY_MAP[registrationCountry]?.currency}</span>
                                        </>
                                    ) : (
                                        <span className="flex-1 text-text-muted text-sm">Select your country <span className="text-danger">*</span></span>
                                    )}
                                    <ChevronDown size={14} className={`text-text-muted transition-transform shrink-0 ${showCountryDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showCountryDropdown && (
                                    <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-bg-elevated border border-divider rounded-xl shadow-xl overflow-hidden">
                                        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-divider">
                                            <Search size={14} className="text-text-muted shrink-0" />
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Search country or currency..."
                                                className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-muted"
                                                value={countrySearch}
                                                onChange={(e) => setCountrySearch(e.target.value)}
                                            />
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto">
                                            {filteredCountries.length === 0 ? (
                                                <div className="px-4 py-3 text-text-muted text-sm text-center">No results</div>
                                            ) : filteredCountries.map((c) => (
                                                <button
                                                    key={c.iso}
                                                    type="button"
                                                    onClick={() => handleRegistrationCountrySelect(c.iso)}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors hover:bg-bg-hover ${registrationCountry === c.iso ? 'bg-brand-gold/10 text-brand-gold' : 'text-text-primary'
                                                        }`}
                                                >
                                                    <span className="text-base leading-none">{c.flag}</span>
                                                    <span className="flex-1 truncate">{c.name}</span>
                                                    <span className="text-text-muted font-mono text-xs shrink-0">{c.currency}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {fieldErrors.registrationCountry && (
                                <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1">
                                    <AlertCircle size={11} /> {fieldErrors.registrationCountry}
                                </p>
                            )}
                        </div>

                        {/* Phone / Email Toggle */}
                        <div className="flex bg-bg-elevated p-1 rounded-xl border border-divider">
                            <button
                                type="button"
                                onClick={() => handleTabChange(true)}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-transform duration-200 ease-out active:scale-[0.97] ${isPhone ? 'bg-auth-action text-text-inverse shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                            >
                                <Smartphone size={15} /> Phone
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTabChange(false)}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-transform duration-200 ease-out active:scale-[0.97] ${!isPhone ? 'bg-auth-action text-text-inverse shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                            >
                                <Mail size={15} /> Email
                            </button>
                        </div>

                        {/* Phone / Email Field */}
                        <div>
                            {isPhone ? (
                                <div className="flex gap-2">
                                    <CountryCodeSelector
                                        value={selectedCountry}
                                        onChange={setSelectedCountry}
                                    />
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        placeholder="Phone number"
                                        autoFocus
                                        className={`flex-1 h-[50px] bg-bg-elevated border rounded-xl px-4 text-text-primary outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted font-medium ${fieldErrors.phoneNumber
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                                            : 'border-divider focus:border-brand-gold focus:ring-brand-gold/40'
                                            }`}
                                        value={formData.phoneNumber}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setFormData({ ...formData, phoneNumber: val });
                                            setFieldErrors(prev => ({ ...prev, phoneNumber: '' }));
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="relative">
                                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        autoFocus
                                        autoComplete="email"
                                        className={`w-full h-[50px] bg-bg-elevated border rounded-xl pl-11 pr-4 text-text-primary outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted font-medium ${fieldErrors.email
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                                            : 'border-divider focus:border-brand-gold focus:ring-brand-gold/40'
                                            }`}
                                        value={formData.email}
                                        onChange={(e) => {
                                            setFormData({ ...formData, email: e.target.value });
                                            setFieldErrors(prev => ({ ...prev, email: '' }));
                                        }}
                                    />
                                </div>
                            )}
                            {fieldErrors.phoneNumber && isPhone && (
                                <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1">
                                    <AlertCircle size={11} /> {fieldErrors.phoneNumber}
                                </p>
                            )}
                            {fieldErrors.email && !isPhone && (
                                <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1">
                                    <AlertCircle size={11} /> {fieldErrors.email}
                                </p>
                            )}
                        </div>

                        {/* Username Field */}
                        <div>
                            <div className="relative">
                                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Username (Optional)"
                                    autoComplete="username"
                                    className={`w-full h-[50px] bg-bg-elevated border rounded-xl pl-11 pr-4 text-text-primary outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted font-medium ${fieldErrors.username
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                                        : 'border-divider focus:border-brand-gold focus:ring-brand-gold/40'
                                        }`}
                                    value={formData.username}
                                    onChange={(e) => {
                                        setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') });
                                        setFieldErrors(prev => ({ ...prev, username: '' }));
                                    }}
                                />
                            </div>
                            {fieldErrors.username && (
                                <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1">
                                    <AlertCircle size={11} /> {fieldErrors.username}
                                </p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div>
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password (min. 8 characters)"
                                    autoComplete="new-password"
                                    className={`w-full h-[50px] bg-bg-elevated border rounded-xl pl-11 pr-12 text-text-primary outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted font-medium ${fieldErrors.password
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                                        : 'border-divider focus:border-brand-gold focus:ring-brand-gold/40'
                                        }`}
                                    value={formData.password}
                                    onChange={(e) => {
                                        setFormData({ ...formData, password: e.target.value });
                                        setFieldErrors(prev => ({ ...prev, password: '' }));
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-muted hover:text-text-primary transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {fieldErrors.password && (
                                <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1">
                                    <AlertCircle size={11} /> {fieldErrors.password}
                                </p>
                            )}
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirm password"
                                    autoComplete="new-password"
                                    className={`w-full h-[50px] bg-bg-elevated border rounded-xl pl-11 pr-12 text-text-primary outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted font-medium ${fieldErrors.confirmPassword
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                                        : 'border-divider focus:border-brand-gold focus:ring-brand-gold/40'
                                        }`}
                                    value={formData.confirmPassword}
                                    onChange={(e) => {
                                        setFormData({ ...formData, confirmPassword: e.target.value });
                                        setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-muted hover:text-text-primary transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {fieldErrors.confirmPassword && (
                                <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1">
                                    <AlertCircle size={11} /> {fieldErrors.confirmPassword}
                                </p>
                            )}
                        </div>

                        {/* ── Welcome Bonus Selector ── */}
                        {signupBonuses.length > 0 && (
                            <div>
                                <label className="flex items-center gap-2 text-sm font-bold text-text-primary mb-2">
                                    <Gift size={15} className="text-brand-gold" />
                                    Choose Your Welcome Bonus
                                </label>
                                <div className="grid gap-2">
                                    {[null, ...signupBonuses].map((bonus: any) => {
                                        const isNone = bonus === null;
                                        const isSelected = isNone ? selectedBonusCode === null : selectedBonusCode === bonus.code;
                                        return (
                                            <button
                                                key={isNone ? 'none' : bonus.code}
                                                type="button"
                                                onClick={() => setSelectedBonusCode(isNone ? null : bonus.code)}
                                                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-transform duration-200 ease-out active:scale-[0.97] text-left ${isSelected
                                                    ? 'border-brand-gold bg-brand-gold/10'
                                                    : 'border-divider bg-bg-elevated hover:border-text-muted'
                                                    }`}
                                            >
                                                {/* Radio circle */}
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-brand-gold' : 'border-text-muted'
                                                    }`}>
                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-brand-gold" />}
                                                </div>

                                                {isNone ? (
                                                    <span className="text-sm text-text-muted font-medium">No Bonus — I&apos;ll decide later</span>
                                                ) : (
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-sm font-bold text-text-primary">{bonus.title}</span>
                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${bonus.forFirstDepositOnly
                                                                ? 'bg-brand-gold/15 text-brand-gold'
                                                                : 'bg-success-alpha-16 text-success-bright'
                                                                }`}>
                                                                {bonus.forFirstDepositOnly ? 'On Deposit' : 'Instant'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-text-muted mt-0.5 whitespace-break-spaces leading-relaxed">
                                                            {(() => {
                                                                const bonusSymbol = getCurrencySymbol('USD');
                                                                const fiatMinimum = bonus.minDepositFiat ?? bonus.minDeposit ?? 0;
                                                                const cryptoMinimum = bonus.minDepositCrypto ?? bonus.minDeposit ?? 0;
                                                                const minimumLabel = bonus.currency === 'CRYPTO'
                                                                    ? (cryptoMinimum > 0 ? ` (min $${cryptoMinimum})` : '')
                                                                    : bonus.currency === 'BOTH'
                                                                        ? ((fiatMinimum > 0 || cryptoMinimum > 0)
                                                                            ? ` (min ${fiatMinimum > 0 ? `${bonusSymbol}${fiatMinimum} fiat` : 'no fiat min'} / ${cryptoMinimum > 0 ? `$${cryptoMinimum} crypto` : 'no crypto min'})`
                                                                            : '')
                                                                        : (fiatMinimum > 0 ? ` (min ${bonusSymbol}${fiatMinimum})` : '');
                                                                return bonus.percentage > 0
                                                                    ? `${bonus.percentage}% match${bonus.maxBonus > 0 ? ` up to ${bonusSymbol}${bonus.maxBonus}` : ''}${minimumLabel}`
                                                                    : `${bonusSymbol}${bonus.amount} bonus`;
                                                            })()} &bull; {bonus.wageringRequirement}x wagering
                                                        </div>
                                                    </div>
                                                )}

                                                {isSelected && !isNone && (
                                                    <Sparkles size={14} className="text-brand-gold shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}



                        {/* Promo Toggle */}
                        <button
                            type="button"
                            onClick={() => setHasPromo(!hasPromo)}
                            className={`w-full h-[50px] border rounded-xl px-4 flex items-center justify-center font-semibold text-sm transition-transform duration-200 ease-out active:scale-[0.97] ${hasPromo
                                ? 'border-brand-gold text-brand-gold bg-brand-gold/10'
                                : 'border-divider text-text-muted hover:text-text-primary bg-bg-elevated hover:border-text-muted'
                                }`}
                        >
                            {hasPromo ? '✓ Promo Code' : '+ Promo Code'}
                        </button>

                        {/* Referral Code Indicator — shown only when a ref code was applied from URL */}
                        {referralCode && (
                            <div className="flex items-center gap-2 bg-success-alpha-10 border border-success-primary/20 rounded-xl px-3 py-2 text-xs">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-green-400 font-medium">Referral code applied:</span>
                                <span className="text-white font-mono font-bold tracking-widest">{referralCode}</span>
                                <button
                                    type="button"
                                    onClick={() => { setReferralCode(''); localStorage.removeItem('referralCode'); }}
                                    className="ml-auto text-green-400/60 hover:text-danger transition-colors text-[10px]"
                                    title="Remove referral"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Promo Code Input */}
                        {hasPromo && (
                            <input
                                type="text"
                                placeholder="Enter promo code"
                                className="w-full h-[50px] bg-bg-elevated border-2 border-dashed border-brand-gold/50 rounded-xl px-4 text-brand-gold outline-none focus:border-brand-gold transition-all placeholder:text-text-muted font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2 duration-200"
                                value={formData.promoCode}
                                onChange={(e) => setFormData({ ...formData, promoCode: e.target.value })}
                            />
                        )}

                        {/* Terms */}
                        <label className="flex items-start gap-3 cursor-pointer group mt-1">
                            <div
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-all mt-0.5 shrink-0 ${termsAccepted ? 'bg-success border-success' : 'border-text-muted bg-transparent'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={termsAccepted}
                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                />
                                {termsAccepted && <Check size={13} className="text-white stroke-[3px]" />}
                            </div>
                            <span className="text-xs text-text-muted leading-tight group-hover:text-text-secondary transition-colors">
                                I confirm all the{' '}
                                <span className="text-text-primary font-bold underline decoration-dotted">Terms of user agreement</span>{' '}
                                and that I am over 18 years of age.
                            </span>
                        </label>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-start gap-2.5 bg-danger-alpha-10 border border-red-500/30 rounded-xl px-4 py-3 animate-in slide-in-from-top-1 duration-200">
                                <AlertCircle size={15} className="text-danger shrink-0 mt-0.5" />
                                <p className="text-danger text-[13px] font-medium leading-snug">{error}</p>
                            </div>
                        )}
                        </div>
                    )} {/* end OTP conditional */}
                    </div>{/* end scrollable body */}

                    {/* ── Sticky footer — submit button always visible ── */}
                    <div className="flex-shrink-0 px-6 pt-3 pb-6 md:px-10 md:pb-6 border-t border-divider/50 bg-auth-base">
                        {regStep === 'verify_otp' ? (
                            <>
                                <button
                                    onClick={handleVerifyOtpAndRegister}
                                    disabled={otpLoading || otpCode.length !== 6}
                                    className="w-full bg-gradient-gold disabled:opacity-50 disabled:cursor-not-allowed text-text-inverse h-[52px] rounded-xl font-extrabold uppercase tracking-wider text-sm transition-transform duration-200 ease-out shadow-lg shadow-glow-gold active:scale-[0.97] flex items-center justify-center gap-2"
                                >
                                    {otpLoading ? <><Loader2 size={16} className="animate-spin" />Verifying &amp; Creating...</> : 'Verify & Create Account'}
                                </button>
                                <div className="flex items-center justify-center gap-4 mt-3 pb-1">
                                    <button
                                        type="button"
                                        onClick={() => { setRegStep('form'); setOtpCode(''); setError(''); setResendCooldown(0); }}
                                        className="text-text-muted text-sm hover:text-brand-gold transition-colors"
                                    >
                                        ← Edit {isPhone ? 'Number' : 'Email'}
                                    </button>
                                    <span className="text-text-muted/30">|</span>
                                    <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={resendCooldown > 0 || resendLoading}
                                        className={`text-sm transition-colors ${resendCooldown > 0 || resendLoading ? 'text-text-muted/40 cursor-not-allowed' : 'text-text-muted hover:text-brand-gold'}`}
                                    >
                                        {resendLoading ? 'Sending...' : resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                                    </button>
                                </div>
                                {otpExpiresIn > 0 ? (
                                    <p className={`text-center text-[11px] mt-1 ${otpExpiresIn <= 30 ? 'text-danger' : 'text-text-muted/50'}`}>
                                        OTP expires in {Math.floor(otpExpiresIn / 60)}:{String(otpExpiresIn % 60).padStart(2, '0')}
                                    </p>
                                ) : regStep === 'verify_otp' && (
                                    <p className="text-center text-[11px] mt-1 text-danger font-medium">
                                        OTP expired — please resend
                                    </p>
                                )}
                            </>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !termsAccepted}
                                className="w-full bg-gradient-gold disabled:opacity-50 disabled:cursor-not-allowed text-text-inverse h-[52px] rounded-xl font-extrabold uppercase tracking-wider text-sm transition-transform duration-200 ease-out shadow-lg shadow-glow-gold active:scale-[0.97] flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><Loader2 size={16} className="animate-spin" />Sending OTP...</>
                                ) : 'Continue with OTP →'}
                            </button>
                        )}
                    </div>

                </div>{/* end right column */}
            </div>
        </div>
    );
};

export default RegisterModal;
