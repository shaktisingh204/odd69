export interface SocketEndpoint {
    url: string;
    path: string;
}

export interface NamespacedSocketEndpoint extends SocketEndpoint {
    namespace: string;
}

function parseConfiguredUrl(rawUrl: string): URL | null {
    const normalizedUrl = rawUrl
        .replace(/^wss:\/\//i, 'https://')
        .replace(/^ws:\/\//i, 'http://')
        .replace(/\/+$/, '');

    try {
        return new URL(normalizedUrl);
    } catch {
        if (typeof window === 'undefined') {
            return null;
        }

        return new URL(normalizedUrl, window.location.origin);
    }
}

function buildSocketPath(pathname: string) {
    let cleanedPath = pathname.replace(/\/+$/, '');
    if (cleanedPath.endsWith('/api')) {
        cleanedPath = cleanedPath.slice(0, -4);
    }
    return cleanedPath ? `${cleanedPath}/socket.io` : '/socket.io';
}

export function getConfiguredSocketEndpoint(): SocketEndpoint | null {
    const explicitSocketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL
        || process.env.NEXT_PUBLIC_WS_URL;

    if (explicitSocketUrl) {
        const parsedUrl = parseConfiguredUrl(explicitSocketUrl);
        if (!parsedUrl) {
            return null;
        }

        return {
            url: parsedUrl.origin,
            path: buildSocketPath(parsedUrl.pathname),
        };
    }

    const apiUrl =
        process.env.NEXT_PUBLIC_API_PROXY_URL
        || process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
        if (typeof window === 'undefined') {
            return null;
        }

        return {
            url: window.location.origin,
            path: '/socket.io',
        };
    }

    const parsedUrl = parseConfiguredUrl(apiUrl);
    if (!parsedUrl) {
        return null;
    }

    const isSameHostAsWebsite =
        typeof window !== 'undefined'
        && parsedUrl.host === window.location.host;

    return {
        url: parsedUrl.origin,
        path: isSameHostAsWebsite ? buildSocketPath(parsedUrl.pathname) : '/socket.io',
    };
}

export function getConfiguredSocketNamespace(namespace: string): NamespacedSocketEndpoint | null {
    const cleanedNamespace = `/${namespace.replace(/^\/+|\/+$/g, '')}`;
    const endpoint = getConfiguredSocketEndpoint();

    if (endpoint) {
        return {
            url: `${endpoint.url}${cleanedNamespace}`,
            path: endpoint.path,
            namespace: cleanedNamespace,
        };
    }

    if (typeof window === 'undefined') {
        return null;
    }

    return {
        url: `${window.location.origin}${cleanedNamespace}`,
        path: '/socket.io',
        namespace: cleanedNamespace,
    };
}
