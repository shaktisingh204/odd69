"use client";

import React, { useState } from 'react';

interface ProviderLike {
    image?: string;
    provider?: string;
    code?: string;
}

interface ProviderLogoProps {
    provider: ProviderLike;
    alt: string;
    className?: string;
    fallbackClassName?: string;
    fallbackText?: string;
}

function getProviderSources(provider: ProviderLike): string[] {
    const customImage = provider.image?.trim();
    const providerCode = (provider.provider || provider.code || '').trim();
    const encodedProvider = providerCode ? encodeURIComponent(providerCode) : '';

    return Array.from(new Set([
        ...(customImage ? [customImage] : []),
        ...(encodedProvider
            ? [
                `/assets/providers/${encodedProvider}.png`,
                `/assets/providers/${encodedProvider}.jpg`,
            ]
            : []),
    ]));
}

function getFallbackLabel(label: string): string {
    const normalized = label.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
    return normalized || 'PR';
}

export default function ProviderLogo({
    provider,
    alt,
    className = '',
    fallbackClassName = '',
    fallbackText,
}: ProviderLogoProps) {
    const sources = getProviderSources(provider);
    const [failedSources, setFailedSources] = useState<Record<string, boolean>>({});
    const src = sources.find((source) => !failedSources[source]);

    if (!src) {
        return (
            <span className={fallbackClassName}>
                {getFallbackLabel(fallbackText || alt)}
            </span>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            loading="lazy"
            onError={() => setFailedSources((current) => ({ ...current, [src]: true }))}
        />
    );
}
