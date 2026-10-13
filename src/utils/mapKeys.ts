const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);

export function keysToCamel<T = Record<string, unknown>>(obj: Record<string, unknown>): T {
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [toCamel(k), v])
    ) as T;
}

export function keysToSnake<T = Record<string, unknown>>(obj: Record<string, unknown>): T {
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [toSnake(k), v])
    ) as T;
}
