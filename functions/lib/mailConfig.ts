/** Configure only after the replacement sender's domain is verified by the mail provider. */
export interface MailFromEnv { MAIL_FROM?: unknown; }

export const DEFAULT_MAIL_FROM = '몽골리아 은하수 <noreply@mongolryokou.com>';
const invalidFrom = () => new Error('MAIL_FROM에 유효한 단일 발신 이메일 주소를 설정해 주세요.');

function validMailbox(address: string): boolean {
    if (address.length > 254) return false;
    const parts = address.split('@');
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    if (!local || local.length > 64 || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) || /^\.|\.$|\.\./.test(local)) return false;
    const labels = domain.split('.');
    return labels.length > 1 && domain.length <= 253 && /[a-z]/i.test(labels[labels.length - 1]) &&
        labels.every(label => label.length <= 63 && /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label));
}

/** One mailbox, optionally with a display name. Invalid configuration fails before any send. */
export function resolveMailFrom(env: MailFromEnv = {}): string {
    const value = env.MAIL_FROM;
    if (value === undefined || value === null) return DEFAULT_MAIL_FROM;
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value) || value.length > 500) throw invalidFrom();
    const sender = value.trim();
    if (!sender) return DEFAULT_MAIL_FROM;
    if (validMailbox(sender)) return sender;
    const match = sender.match(/^([^<>]+)\s*<([^<>]+)>$/);
    if (!match || !validMailbox(match[2])) throw invalidFrom();
    const display = match[1].trim();
    if (!display || /[\\]/.test(display)) throw invalidFrom();
    // Commas/semicolons in a display name require quotes, never a second mailbox.
    if (display.startsWith('"')) {
        if (!/^"[^"\\]+"$/.test(display)) throw invalidFrom();
    } else if (/[",;]/.test(display)) throw invalidFrom();
    return sender;
}
