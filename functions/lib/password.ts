// Password hashing utilities using Web Crypto API (Cloudflare Workers compatible)

export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        256
    );
    const hashArray = new Uint8Array(derivedBits);
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    try {
        const [saltHex, hashHex] = storedHash.split(':');
        const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
        const encoder = new TextEncoder();

        // Use global crypto in Cloudflare Workers context
        const cryptoObj = typeof crypto !== 'undefined' ? crypto : (globalThis as any).crypto;

        if (!cryptoObj || !cryptoObj.subtle) {
            throw new Error('Web Crypto API is not available in this environment');
        }

        const keyMaterial = await cryptoObj.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        const derivedBits = await cryptoObj.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            256
        );
        const newHashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
        return newHashHex === hashHex;
    } catch (e) {
        console.error('Crypto error in verifyPassword:', e);
        throw e;
    }
}
