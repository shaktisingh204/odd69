export interface PaymentMethod {
    id: string;
    label: string;
    icon: string; // Emoji or URL
    badge?: string;
    subLabel?: string;
}

export interface Country {
    name: string;
    code: string;
    flag: string;
    currency: string;
    paymentMethods: PaymentMethod[];
}

const defaultPaymentMethods: PaymentMethod[] = [
    { id: 'VISA', label: 'Visa / Mastercard', icon: '💳', subLabel: 'Instant' },
    { id: 'CRYPTO', label: 'Cryptocurrency', icon: '₿', badge: 'Anonymous' },
];

export const countries: Country[] = [
    { name: 'Afghanistan', code: 'AF', flag: '🇦🇫', currency: 'AFN', paymentMethods: defaultPaymentMethods },
    { name: 'Albania', code: 'AL', flag: '🇦🇱', currency: 'ALL', paymentMethods: defaultPaymentMethods },
    { name: 'Algeria', code: 'DZ', flag: '🇩🇿', currency: 'DZD', paymentMethods: defaultPaymentMethods },
    { name: 'Andorra', code: 'AD', flag: '🇦🇩', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Angola', code: 'AO', flag: '🇦🇴', currency: 'AOA', paymentMethods: defaultPaymentMethods },
    { name: 'Antigua and Barbuda', code: 'AG', flag: '🇦🇬', currency: 'XCD', paymentMethods: defaultPaymentMethods },
    { name: 'Argentina', code: 'AR', flag: '🇦🇷', currency: 'ARS', paymentMethods: [...defaultPaymentMethods, { id: 'MERCADO_PAGO', label: 'Mercado Pago', icon: 'MP', badge: 'Popular' }] },
    { name: 'Armenia', code: 'AM', flag: '🇦🇲', currency: 'AMD', paymentMethods: defaultPaymentMethods },
    { name: 'Australia', code: 'AU', flag: '🇦🇺', currency: 'AUD', paymentMethods: [{ id: 'PAYID', label: 'PayID', icon: '🆔', badge: 'Instant' }, ...defaultPaymentMethods] },
    { name: 'Austria', code: 'AT', flag: '🇦🇹', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Azerbaijan', code: 'AZ', flag: '🇦🇿', currency: 'AZN', paymentMethods: defaultPaymentMethods },
    { name: 'Bahamas', code: 'BS', flag: '🇧🇸', currency: 'BSD', paymentMethods: defaultPaymentMethods },
    { name: 'Bahrain', code: 'BH', flag: '🇧🇭', currency: 'BHD', paymentMethods: defaultPaymentMethods },
    { name: 'Bangladesh', code: 'BD', flag: '🇧🇩', currency: 'BDT', paymentMethods: [{ id: 'BKASH', label: 'bKash', icon: '৳', badge: 'Popular' }, { id: 'NAGAD', label: 'Nagad', icon: 'N' }, ...defaultPaymentMethods] },
    { name: 'Barbados', code: 'BB', flag: '🇧🇧', currency: 'BBD', paymentMethods: defaultPaymentMethods },
    { name: 'Belarus', code: 'BY', flag: '🇧🇾', currency: 'BYN', paymentMethods: defaultPaymentMethods },
    { name: 'Belgium', code: 'BE', flag: '🇧🇪', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Belize', code: 'BZ', flag: '🇧🇿', currency: 'BZD', paymentMethods: defaultPaymentMethods },
    { name: 'Benin', code: 'BJ', flag: '🇧🇯', currency: 'XOF', paymentMethods: defaultPaymentMethods },
    { name: 'Bhutan', code: 'BT', flag: '🇧🇹', currency: 'BTN', paymentMethods: defaultPaymentMethods },
    { name: 'Bolivia', code: 'BO', flag: '🇧🇴', currency: 'BOB', paymentMethods: defaultPaymentMethods },
    { name: 'Bosnia and Herzegovina', code: 'BA', flag: '🇧🇦', currency: 'BAM', paymentMethods: defaultPaymentMethods },
    { name: 'Botswana', code: 'BW', flag: '🇧🇼', currency: 'BWP', paymentMethods: defaultPaymentMethods },
    { name: 'Brazil', code: 'BR', flag: '🇧🇷', currency: 'BRL', paymentMethods: [{ id: 'PIX', label: 'PIX', icon: '💠', badge: 'Instant' }, ...defaultPaymentMethods] },
    { name: 'Brunei', code: 'BN', flag: '🇧🇳', currency: 'BND', paymentMethods: defaultPaymentMethods },
    { name: 'Bulgaria', code: 'BG', flag: '🇧🇬', currency: 'BGN', paymentMethods: defaultPaymentMethods },
    { name: 'Burkina Faso', code: 'BF', flag: '🇧🇫', currency: 'XOF', paymentMethods: defaultPaymentMethods },
    { name: 'Burundi', code: 'BI', flag: '🇧🇮', currency: 'BIF', paymentMethods: defaultPaymentMethods },
    { name: 'Cabo Verde', code: 'CV', flag: '🇨🇻', currency: 'CVE', paymentMethods: defaultPaymentMethods },
    { name: 'Cambodia', code: 'KH', flag: '🇰🇭', currency: 'KHR', paymentMethods: defaultPaymentMethods },
    { name: 'Cameroon', code: 'CM', flag: '🇨🇲', currency: 'XAF', paymentMethods: defaultPaymentMethods },
    { name: 'Canada', code: 'CA', flag: '🇨🇦', currency: 'CAD', paymentMethods: [{ id: 'INTERAC', label: 'Interac', icon: '🇨🇦', badge: 'Popular' }, ...defaultPaymentMethods] },
    { name: 'Central African Republic', code: 'CF', flag: '🇨🇫', currency: 'XAF', paymentMethods: defaultPaymentMethods },
    { name: 'Chad', code: 'TD', flag: '🇹🇩', currency: 'XAF', paymentMethods: defaultPaymentMethods },
    { name: 'Chile', code: 'CL', flag: '🇨🇱', currency: 'CLP', paymentMethods: defaultPaymentMethods },
    { name: 'China', code: 'CN', flag: '🇨🇳', currency: 'CNY', paymentMethods: [{ id: 'ALIPAY', label: 'Alipay', icon: '支' }, { id: 'WECHAT', label: 'WeChat Pay', icon: '💬' }, ...defaultPaymentMethods] },
    { name: 'Colombia', code: 'CO', flag: '🇨🇴', currency: 'COP', paymentMethods: defaultPaymentMethods },
    { name: 'Comoros', code: 'KM', flag: '🇰🇲', currency: 'KMF', paymentMethods: defaultPaymentMethods },
    { name: 'Democratic Republic of the Congo', code: 'CD', flag: '🇨🇩', currency: 'CDF', paymentMethods: defaultPaymentMethods },
    { name: 'Republic of the Congo', code: 'CG', flag: '🇨🇬', currency: 'XAF', paymentMethods: defaultPaymentMethods },
    { name: 'Costa Rica', code: 'CR', flag: '🇨🇷', currency: 'CRC', paymentMethods: defaultPaymentMethods },
    { name: 'Croatia', code: 'HR', flag: '🇭🇷', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Cuba', code: 'CU', flag: '🇨🇺', currency: 'CUP', paymentMethods: defaultPaymentMethods },
    { name: 'Cyprus', code: 'CY', flag: '🇨🇾', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Czech Republic', code: 'CZ', flag: '🇨🇿', currency: 'CZK', paymentMethods: defaultPaymentMethods },
    { name: 'Denmark', code: 'DK', flag: '🇩🇰', currency: 'DKK', paymentMethods: defaultPaymentMethods },
    { name: 'Djibouti', code: 'DJ', flag: '🇩🇯', currency: 'DJF', paymentMethods: defaultPaymentMethods },
    { name: 'Dominica', code: 'DM', flag: '🇩🇲', currency: 'XCD', paymentMethods: defaultPaymentMethods },
    { name: 'Dominican Republic', code: 'DO', flag: '🇩🇴', currency: 'DOP', paymentMethods: defaultPaymentMethods },
    { name: 'East Timor', code: 'TL', flag: '🇹🇱', currency: 'USD', paymentMethods: defaultPaymentMethods },
    { name: 'Ecuador', code: 'EC', flag: '🇪🇨', currency: 'USD', paymentMethods: defaultPaymentMethods },
    { name: 'Egypt', code: 'EG', flag: '🇪🇬', currency: 'EGP', paymentMethods: defaultPaymentMethods },
    { name: 'El Salvador', code: 'SV', flag: '🇸🇻', currency: 'USD', paymentMethods: defaultPaymentMethods },
    { name: 'Equatorial Guinea', code: 'GQ', flag: '🇬🇶', currency: 'XAF', paymentMethods: defaultPaymentMethods },
    { name: 'Eritrea', code: 'ER', flag: '🇪🇷', currency: 'ERN', paymentMethods: defaultPaymentMethods },
    { name: 'Estonia', code: 'EE', flag: '🇪🇪', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Eswatini', code: 'SZ', flag: '🇸🇿', currency: 'SZL', paymentMethods: defaultPaymentMethods },
    { name: 'Ethiopia', code: 'ET', flag: '🇪🇹', currency: 'ETB', paymentMethods: defaultPaymentMethods },
    { name: 'Fiji', code: 'FJ', flag: '🇫🇯', currency: 'FJD', paymentMethods: defaultPaymentMethods },
    { name: 'Finland', code: 'FI', flag: '🇫🇮', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'France', code: 'FR', flag: '🇫🇷', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Gabon', code: 'GA', flag: '🇬🇦', currency: 'XAF', paymentMethods: defaultPaymentMethods },
    { name: 'Gambia', code: 'GM', flag: '🇬🇲', currency: 'GMD', paymentMethods: defaultPaymentMethods },
    { name: 'Georgia', code: 'GE', flag: '🇬🇪', currency: 'GEL', paymentMethods: defaultPaymentMethods },
    { name: 'Germany', code: 'DE', flag: '🇩🇪', currency: 'EUR', paymentMethods: [{ id: 'SOFORT', label: 'Sofort', icon: 'S' }, ...defaultPaymentMethods] },
    { name: 'Ghana', code: 'GH', flag: '🇬🇭', currency: 'GHS', paymentMethods: [{ id: 'MOMO', label: 'MTN Mobile Money', icon: '📱' }, ...defaultPaymentMethods] },
    { name: 'Greece', code: 'GR', flag: '🇬🇷', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Grenada', code: 'GD', flag: '🇬🇩', currency: 'XCD', paymentMethods: defaultPaymentMethods },
    { name: 'Guatemala', code: 'GT', flag: '🇬🇹', currency: 'GTQ', paymentMethods: defaultPaymentMethods },
    { name: 'Guinea', code: 'GN', flag: '🇬🇳', currency: 'GNF', paymentMethods: defaultPaymentMethods },
    { name: 'Guinea-Bissau', code: 'GW', flag: '🇬🇼', currency: 'XOF', paymentMethods: defaultPaymentMethods },
    { name: 'Guyana', code: 'GY', flag: '🇬🇾', currency: 'GYD', paymentMethods: defaultPaymentMethods },
    { name: 'Haiti', code: 'HT', flag: '🇭🇹', currency: 'HTG', paymentMethods: defaultPaymentMethods },
    { name: 'Honduras', code: 'HN', flag: '🇭🇳', currency: 'HNL', paymentMethods: defaultPaymentMethods },
    { name: 'Hungary', code: 'HU', flag: '🇭🇺', currency: 'HUF', paymentMethods: defaultPaymentMethods },
    { name: 'Iceland', code: 'IS', flag: '🇮🇸', currency: 'ISK', paymentMethods: defaultPaymentMethods },
    { name: 'India', code: 'IN', flag: '🇮🇳', currency: 'INR', paymentMethods: [{ id: 'CASHFREE', label: 'Cashfree Gateway', icon: '💳', badge: 'Fast' }, { id: 'UPI1', label: 'UPI Gateway 1', icon: 'UPI', badge: 'Recommended' }, { id: 'UPI2', label: 'UPI Gateway 2', icon: 'UPI' }, { id: 'UPI3', label: 'UPI Gateway 3', icon: 'UPI' }, { id: 'UPI4', label: 'UPI Gateway 4', icon: 'UPI' }, { id: 'UPI5', label: 'UPI Gateway 5', icon: 'UPI', badge: 'New' }, { id: 'UPI6', label: 'UPI Gateway 6', icon: 'UPI' }, { id: 'UPI9', label: 'UPI Gateway 9', icon: 'UPI', badge: 'New' }, { id: 'UPI0', label: 'UPI Gateway 0', icon: 'UPI' }] },
    { name: 'Indonesia', code: 'ID', flag: '🇮🇩', currency: 'IDR', paymentMethods: [{ id: 'OVO', label: 'OVO', icon: '🟣' }, { id: 'DANA', label: 'DANA', icon: '🔵' }, ...defaultPaymentMethods] },
    { name: 'Iran', code: 'IR', flag: '🇮🇷', currency: 'IRR', paymentMethods: defaultPaymentMethods },
    { name: 'Iraq', code: 'IQ', flag: '🇮🇶', currency: 'IQD', paymentMethods: defaultPaymentMethods },
    { name: 'Ireland', code: 'IE', flag: '🇮🇪', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Israel', code: 'IL', flag: '🇮🇱', currency: 'ILS', paymentMethods: defaultPaymentMethods },
    { name: 'Italy', code: 'IT', flag: '🇮🇹', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Ivory Coast', code: 'CI', flag: '🇨🇮', currency: 'XOF', paymentMethods: defaultPaymentMethods },
    { name: 'Jamaica', code: 'JM', flag: '🇯🇲', currency: 'JMD', paymentMethods: defaultPaymentMethods },
    { name: 'Japan', code: 'JP', flag: '🇯🇵', currency: 'JPY', paymentMethods: defaultPaymentMethods },
    { name: 'Jordan', code: 'JO', flag: '🇯🇴', currency: 'JOD', paymentMethods: defaultPaymentMethods },
    { name: 'Kazakhstan', code: 'KZ', flag: '🇰🇿', currency: 'KZT', paymentMethods: defaultPaymentMethods },
    { name: 'Kenya', code: 'KE', flag: '🇰🇪', currency: 'KES', paymentMethods: [{ id: 'MPESA', label: 'M-Pesa', icon: '📲', badge: 'Popular' }, ...defaultPaymentMethods] },
    { name: 'Kiribati', code: 'KI', flag: '🇰🇮', currency: 'AUD', paymentMethods: defaultPaymentMethods },
    { name: 'Kuwait', code: 'KW', flag: '🇰🇼', currency: 'KWD', paymentMethods: defaultPaymentMethods },
    { name: 'Kyrgyzstan', code: 'KG', flag: '🇰🇬', currency: 'KGS', paymentMethods: defaultPaymentMethods },
    { name: 'Laos', code: 'LA', flag: '🇱🇦', currency: 'LAK', paymentMethods: defaultPaymentMethods },
    { name: 'Latvia', code: 'LV', flag: '🇱🇻', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Lebanon', code: 'LB', flag: '🇱🇧', currency: 'LBP', paymentMethods: defaultPaymentMethods },
    { name: 'Lesotho', code: 'LS', flag: '🇱🇸', currency: 'LSL', paymentMethods: defaultPaymentMethods },
    { name: 'Liberia', code: 'LR', flag: '🇱🇷', currency: 'LRD', paymentMethods: defaultPaymentMethods },
    { name: 'Libya', code: 'LY', flag: '🇱🇾', currency: 'LYD', paymentMethods: defaultPaymentMethods },
    { name: 'Liechtenstein', code: 'LI', flag: '🇱🇮', currency: 'CHF', paymentMethods: defaultPaymentMethods },
    { name: 'Lithuania', code: 'LT', flag: '🇱🇹', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Luxembourg', code: 'LU', flag: '🇱🇺', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Madagascar', code: 'MG', flag: '🇲🇬', currency: 'MGA', paymentMethods: defaultPaymentMethods },
    { name: 'Malawi', code: 'MW', flag: '🇲🇼', currency: 'MWK', paymentMethods: defaultPaymentMethods },
    { name: 'Malaysia', code: 'MY', flag: '🇲🇾', currency: 'MYR', paymentMethods: defaultPaymentMethods },
    { name: 'Maldives', code: 'MV', flag: '🇲🇻', currency: 'MVR', paymentMethods: defaultPaymentMethods },
    { name: 'Mali', code: 'ML', flag: '🇲🇱', currency: 'XOF', paymentMethods: defaultPaymentMethods },
    { name: 'Malta', code: 'MT', flag: '🇲🇹', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Marshall Islands', code: 'MH', flag: '🇲🇭', currency: 'USD', paymentMethods: defaultPaymentMethods },
    { name: 'Mauritania', code: 'MR', flag: '🇲🇷', currency: 'MRU', paymentMethods: defaultPaymentMethods },
    { name: 'Mauritius', code: 'MU', flag: '🇲🇺', currency: 'MUR', paymentMethods: defaultPaymentMethods },
    { name: 'Mexico', code: 'MX', flag: '🇲🇽', currency: 'MXN', paymentMethods: defaultPaymentMethods },
    { name: 'Micronesia', code: 'FM', flag: '🇫🇲', currency: 'USD', paymentMethods: defaultPaymentMethods },
    { name: 'Moldova', code: 'MD', flag: '🇲🇩', currency: 'MDL', paymentMethods: defaultPaymentMethods },
    { name: 'Monaco', code: 'MC', flag: '🇲🇨', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Mongolia', code: 'MN', flag: '🇲🇳', currency: 'MNT', paymentMethods: defaultPaymentMethods },
    { name: 'Montenegro', code: 'ME', flag: '🇲🇪', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Morocco', code: 'MA', flag: '🇲🇦', currency: 'MAD', paymentMethods: defaultPaymentMethods },
    { name: 'Mozambique', code: 'MZ', flag: '🇲🇿', currency: 'MZN', paymentMethods: defaultPaymentMethods },
    { name: 'Myanmar', code: 'MM', flag: '🇲🇲', currency: 'MMK', paymentMethods: defaultPaymentMethods },
    { name: 'Namibia', code: 'NA', flag: '🇳🇦', currency: 'NAD', paymentMethods: defaultPaymentMethods },
    { name: 'Nauru', code: 'NR', flag: '🇳🇷', currency: 'AUD', paymentMethods: defaultPaymentMethods },
    { name: 'Nepal', code: 'NP', flag: '🇳🇵', currency: 'NPR', paymentMethods: defaultPaymentMethods },
    { name: 'Netherlands', code: 'NL', flag: '🇳🇱', currency: 'EUR', paymentMethods: [{ id: 'IDEAL', label: 'iDEAL', icon: 'i', badge: 'Popular' }, ...defaultPaymentMethods] },
    { name: 'New Zealand', code: 'NZ', flag: '🇳🇿', currency: 'NZD', paymentMethods: defaultPaymentMethods },
    { name: 'Nicaragua', code: 'NI', flag: '🇳🇮', currency: 'NIO', paymentMethods: defaultPaymentMethods },
    { name: 'Niger', code: 'NE', flag: '🇳🇪', currency: 'XOF', paymentMethods: defaultPaymentMethods },
    { name: 'Nigeria', code: 'NG', flag: '🇳🇬', currency: 'NGN', paymentMethods: [{ id: 'OPAY', label: 'OPay', icon: '🟢', badge: 'Popular' }, { id: 'PALMPAY', label: 'PalmPay', icon: '🌴' }, ...defaultPaymentMethods] },
    { name: 'North Korea', code: 'KP', flag: '🇰🇵', currency: 'KPW', paymentMethods: defaultPaymentMethods },
    { name: 'North Macedonia', code: 'MK', flag: '🇲🇰', currency: 'MKD', paymentMethods: defaultPaymentMethods },
    { name: 'Norway', code: 'NO', flag: '🇳🇴', currency: 'NOK', paymentMethods: defaultPaymentMethods },
    { name: 'Oman', code: 'OM', flag: '🇴🇲', currency: 'OMR', paymentMethods: defaultPaymentMethods },
    { name: 'Pakistan', code: 'PK', flag: '🇵🇰', currency: 'PKR', paymentMethods: [{ id: 'EASYPAISA', label: 'EasyPaisa', icon: '🟢', badge: 'Popular' }, { id: 'JAZZCASH', label: 'JazzCash', icon: '🔴' }, ...defaultPaymentMethods] },
    { name: 'Palau', code: 'PW', flag: '🇵🇼', currency: 'USD', paymentMethods: defaultPaymentMethods },
    { name: 'Palestine', code: 'PS', flag: '🇵🇸', currency: 'ILS', paymentMethods: defaultPaymentMethods },
    { name: 'Panama', code: 'PA', flag: '🇵🇦', currency: 'PAB', paymentMethods: defaultPaymentMethods },
    { name: 'Papua New Guinea', code: 'PG', flag: '🇵🇬', currency: 'PGK', paymentMethods: defaultPaymentMethods },
    { name: 'Paraguay', code: 'PY', flag: '🇵🇾', currency: 'PYG', paymentMethods: defaultPaymentMethods },
    { name: 'Peru', code: 'PE', flag: '🇵🇪', currency: 'PEN', paymentMethods: defaultPaymentMethods },
    { name: 'Philippines', code: 'PH', flag: '🇵🇭', currency: 'PHP', paymentMethods: [{ id: 'GCASH', label: 'GCash', icon: '🔵', badge: 'Popular' }, ...defaultPaymentMethods] },
    { name: 'Poland', code: 'PL', flag: '🇵🇱', currency: 'PLN', paymentMethods: [{ id: 'BLIK', label: 'BLIK', icon: '6️⃣' }, ...defaultPaymentMethods] },
    { name: 'Portugal', code: 'PT', flag: '🇵🇹', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Qatar', code: 'QA', flag: '🇶🇦', currency: 'QAR', paymentMethods: defaultPaymentMethods },
    { name: 'Romania', code: 'RO', flag: '🇷🇴', currency: 'RON', paymentMethods: defaultPaymentMethods },
    { name: 'Russia', code: 'RU', flag: '🇷🇺', currency: 'RUB', paymentMethods: defaultPaymentMethods },
    { name: 'Rwanda', code: 'RW', flag: '🇷🇼', currency: 'RWF', paymentMethods: defaultPaymentMethods },
    { name: 'Saint Kitts and Nevis', code: 'KN', flag: '🇰🇳', currency: 'XCD', paymentMethods: defaultPaymentMethods },
    { name: 'Saint Lucia', code: 'LC', flag: '🇱🇨', currency: 'XCD', paymentMethods: defaultPaymentMethods },
    { name: 'Saint Vincent and the Grenadines', code: 'VC', flag: '🇻🇨', currency: 'XCD', paymentMethods: defaultPaymentMethods },
    { name: 'Samoa', code: 'WS', flag: '🇼🇸', currency: 'WST', paymentMethods: defaultPaymentMethods },
    { name: 'San Marino', code: 'SM', flag: '🇸🇲', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Sao Tome and Principe', code: 'ST', flag: '🇸🇹', currency: 'STN', paymentMethods: defaultPaymentMethods },
    { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦', currency: 'SAR', paymentMethods: defaultPaymentMethods },
    { name: 'Senegal', code: 'SN', flag: '🇸🇳', currency: 'XOF', paymentMethods: defaultPaymentMethods },
    { name: 'Serbia', code: 'RS', flag: '🇷🇸', currency: 'RSD', paymentMethods: defaultPaymentMethods },
    { name: 'Seychelles', code: 'SC', flag: '🇸🇨', currency: 'SCR', paymentMethods: defaultPaymentMethods },
    { name: 'Sierra Leone', code: 'SL', flag: '🇸🇱', currency: 'SLL', paymentMethods: defaultPaymentMethods },
    { name: 'Singapore', code: 'SG', flag: '🇸🇬', currency: 'SGD', paymentMethods: defaultPaymentMethods },
    { name: 'Slovakia', code: 'SK', flag: '🇸🇰', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Slovenia', code: 'SI', flag: '🇸🇮', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Solomon Islands', code: 'SB', flag: '🇸🇧', currency: 'SBD', paymentMethods: defaultPaymentMethods },
    { name: 'Somalia', code: 'SO', flag: '🇸🇴', currency: 'SOS', paymentMethods: defaultPaymentMethods },
    { name: 'South Africa', code: 'ZA', flag: '🇿🇦', currency: 'ZAR', paymentMethods: defaultPaymentMethods },
    { name: 'South Korea', code: 'KR', flag: '🇰🇷', currency: 'KRW', paymentMethods: defaultPaymentMethods },
    { name: 'South Sudan', code: 'SS', flag: '🇸🇸', currency: 'SSP', paymentMethods: defaultPaymentMethods },
    { name: 'Spain', code: 'ES', flag: '🇪🇸', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Sri Lanka', code: 'LK', flag: '🇱🇰', currency: 'LKR', paymentMethods: defaultPaymentMethods },
    { name: 'Sudan', code: 'SD', flag: '🇸🇩', currency: 'SDG', paymentMethods: defaultPaymentMethods },
    { name: 'Suriname', code: 'SR', flag: '🇸🇷', currency: 'SRD', paymentMethods: defaultPaymentMethods },
    { name: 'Sweden', code: 'SE', flag: '🇸🇪', currency: 'SEK', paymentMethods: defaultPaymentMethods },
    { name: 'Switzerland', code: 'CH', flag: '🇨🇭', currency: 'CHF', paymentMethods: defaultPaymentMethods },
    { name: 'Syria', code: 'SY', flag: '🇸🇾', currency: 'SYP', paymentMethods: defaultPaymentMethods },
    { name: 'Taiwan', code: 'TW', flag: '🇹🇼', currency: 'TWD', paymentMethods: defaultPaymentMethods },
    { name: 'Tajikistan', code: 'TJ', flag: '🇹🇯', currency: 'TJS', paymentMethods: defaultPaymentMethods },
    { name: 'Tanzania', code: 'TZ', flag: '🇹🇿', currency: 'TZS', paymentMethods: defaultPaymentMethods },
    { name: 'Thailand', code: 'TH', flag: '🇹🇭', currency: 'THB', paymentMethods: defaultPaymentMethods },
    { name: 'Togo', code: 'TG', flag: '🇹🇬', currency: 'XOF', paymentMethods: defaultPaymentMethods },
    { name: 'Tonga', code: 'TO', flag: '🇹🇴', currency: 'TOP', paymentMethods: defaultPaymentMethods },
    { name: 'Trinidad and Tobago', code: 'TT', flag: '🇹🇹', currency: 'TTD', paymentMethods: defaultPaymentMethods },
    { name: 'Tunisia', code: 'TN', flag: '🇹🇳', currency: 'TND', paymentMethods: defaultPaymentMethods },
    { name: 'Turkey', code: 'TR', flag: '🇹🇷', currency: 'TRY', paymentMethods: defaultPaymentMethods },
    { name: 'Turkmenistan', code: 'TM', flag: '🇹🇲', currency: 'TMT', paymentMethods: defaultPaymentMethods },
    { name: 'Tuvalu', code: 'TV', flag: '🇹🇻', currency: 'AUD', paymentMethods: defaultPaymentMethods },
    { name: 'Uganda', code: 'UG', flag: '🇺🇬', currency: 'UGX', paymentMethods: defaultPaymentMethods },
    { name: 'Ukraine', code: 'UA', flag: '🇺🇦', currency: 'UAH', paymentMethods: defaultPaymentMethods },
    { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', currency: 'AED', paymentMethods: defaultPaymentMethods },
    { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', currency: 'GBP', paymentMethods: defaultPaymentMethods },
    { name: 'United States', code: 'US', flag: '🇺🇸', currency: 'USD', paymentMethods: defaultPaymentMethods },
    { name: 'USA', code: 'US', flag: '🇺🇸', currency: 'USD', paymentMethods: defaultPaymentMethods },
    { name: 'Uruguay', code: 'UY', flag: '🇺🇾', currency: 'UYU', paymentMethods: defaultPaymentMethods },
    { name: 'Uzbekistan', code: 'UZ', flag: '🇺🇿', currency: 'UZS', paymentMethods: defaultPaymentMethods },
    { name: 'Vanuatu', code: 'VU', flag: '🇻🇺', currency: 'VUV', paymentMethods: defaultPaymentMethods },
    { name: 'Vatican City', code: 'VA', flag: '🇻🇦', currency: 'EUR', paymentMethods: defaultPaymentMethods },
    { name: 'Venezuela', code: 'VE', flag: '🇻🇪', currency: 'VES', paymentMethods: defaultPaymentMethods },
    { name: 'Vietnam', code: 'VN', flag: '🇻🇳', currency: 'VND', paymentMethods: [{ id: 'MOMO_VN', label: 'Momo', icon: '🟪' }, { id: 'ZALOPAY', label: 'ZaloPay', icon: '🟢' }, ...defaultPaymentMethods] },
    { name: 'Yemen', code: 'YE', flag: '🇾🇪', currency: 'YER', paymentMethods: defaultPaymentMethods },
    { name: 'Zambia', code: 'ZM', flag: '🇿🇲', currency: 'ZMW', paymentMethods: defaultPaymentMethods },
    { name: 'Zimbabwe', code: 'ZW', flag: '🇿🇼', currency: 'USD', paymentMethods: defaultPaymentMethods },
    // Special Regions
    { name: 'International', code: 'INT', flag: '🌐', currency: 'USD', paymentMethods: defaultPaymentMethods },
    { name: 'World', code: 'INT', flag: '🌐', currency: 'USD', paymentMethods: defaultPaymentMethods },
    { name: 'Europe', code: 'EU', flag: '🇪🇺', currency: 'EUR', paymentMethods: defaultPaymentMethods },
];

export const getRegionFlag = (region: string): string => {
    const lower = region.toLowerCase();

    // Direct match check
    const exactMatch = countries.find(c => c.name.toLowerCase() === lower);
    if (exactMatch) return exactMatch.flag;

    // Substring match check
    const matched = countries.find(c => lower.includes(c.name.toLowerCase()));

    if (matched) return matched.flag;

    // Common aliases
    if (lower.includes('uk') || lower.includes('england') || lower.includes('great britain')) return '🇬🇧';
    if (lower.includes('usa') || lower.includes('america')) return '🇺🇸';
    if (lower.includes('uae')) return '🇦🇪';

    // Leagues
    if (lower.includes('ipl') || lower.includes('barclays')) return '🇮🇳';
    if (lower.includes('premier league')) return '🇬🇧'; // Assuming English PL is dominant
    if (lower.includes('la liga')) return '🇪🇸';
    if (lower.includes('bundesliga')) return '🇩🇪';
    if (lower.includes('serie a')) return '🇮🇹';
    if (lower.includes('ligue 1')) return '🇫🇷';
    if (lower.includes('nba')) return '🇺🇸';
    if (lower.includes('big bash')) return '🇦🇺';
    if (lower.includes('psl')) return '🇵🇰';

    return '🏳️';
};

export const getFlagByCode = (code: string): string => {
    if (!code) return '🌐';
    const country = countries.find(c => c.code === code.toUpperCase());
    return country ? country.flag : '🌐';
};
