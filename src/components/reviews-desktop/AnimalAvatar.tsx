export const ANIMALS = ['sheep', 'camel', 'horse', 'marmot'] as const;
export type Animal = (typeof ANIMALS)[number];

/** Illustrated animal avatars from the design, used for reviewers on the PC home and review pages. */
export function AnimalAvatar({ kind, size = 40 }: { kind: Animal; size?: number }) {
    const eyes = (y: number) => (
        <>
            <circle cx="15.5" cy={y} r="2.2" fill="#0A1F2E" />
            <circle cx="24.5" cy={y} r="2.2" fill="#0A1F2E" />
            <circle cx="16.2" cy={y - 0.8} r="0.7" fill="#fff" />
            <circle cx="25.2" cy={y - 0.8} r="0.7" fill="#fff" />
            <ellipse cx="12.5" cy={y + 4} rx="2.2" ry="1.4" fill="#FF9FB0" opacity="0.7" />
            <ellipse cx="27.5" cy={y + 4} rx="2.2" ry="1.4" fill="#FF9FB0" opacity="0.7" />
        </>
    );
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
            {kind === 'sheep' && (
                <>
                    <circle cx="20" cy="20" r="20" fill="#D1F6EA" />
                    <g fill="#FFFFFF" stroke="#E3E6E2" strokeWidth="0.6">
                        <circle cx="13" cy="13" r="5" />
                        <circle cx="20" cy="10.5" r="5.5" />
                        <circle cx="27" cy="13" r="5" />
                        <circle cx="10.5" cy="20" r="4.5" />
                        <circle cx="29.5" cy="20" r="4.5" />
                    </g>
                    <ellipse cx="7.5" cy="19" rx="3.2" ry="1.8" fill="#F4E3D3" transform="rotate(-25 7.5 19)" />
                    <ellipse cx="32.5" cy="19" rx="3.2" ry="1.8" fill="#F4E3D3" transform="rotate(25 32.5 19)" />
                    <ellipse cx="20" cy="22.5" rx="9" ry="9.5" fill="#FFF6EC" />
                    {eyes(21.5)}
                    <path d="M18.2 26.3q1.8 1.6 3.6 0" stroke="#0A1F2E" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                </>
            )}
            {kind === 'camel' && (
                <>
                    <circle cx="20" cy="20" r="20" fill="#A3ECD6" />
                    <ellipse cx="11" cy="12" rx="2.6" ry="3.6" fill="#C98F55" />
                    <ellipse cx="29" cy="12" rx="2.6" ry="3.6" fill="#C98F55" />
                    <ellipse cx="20" cy="20" rx="10.5" ry="11" fill="#E0AC72" />
                    <path d="M14 11q6-4 12 0q-2 3-6 3t-6-3z" fill="#C98F55" />
                    <ellipse cx="20" cy="27" rx="7" ry="5" fill="#F3D2A8" />
                    {eyes(19)}
                    <circle cx="18" cy="26" r="0.9" fill="#8A5A32" />
                    <circle cx="22" cy="26" r="0.9" fill="#8A5A32" />
                    <path d="M18.3 29q1.7 1.2 3.4 0" stroke="#8A5A32" strokeWidth="1" fill="none" strokeLinecap="round" />
                </>
            )}
            {kind === 'horse' && (
                <>
                    <circle cx="20" cy="20" r="20" fill="#D1F6EA" />
                    <path d="M12 9l1.5 5.5-4 .5z" fill="#9A6440" />
                    <path d="M28 9l-1.5 5.5 4 .5z" fill="#9A6440" />
                    <ellipse cx="20" cy="21" rx="9.5" ry="11.5" fill="#B57A4F" />
                    <path d="M13 12q7-6 14 0q-3 1-4 5q-3-4-10-5z" fill="#4A2F20" />
                    <ellipse cx="20" cy="28" rx="7" ry="5" fill="#E2B892" />
                    {eyes(20)}
                    <circle cx="17.8" cy="27.5" r="0.9" fill="#6B4228" />
                    <circle cx="22.2" cy="27.5" r="0.9" fill="#6B4228" />
                    <path d="M18.3 30.3q1.7 1.1 3.4 0" stroke="#6B4228" strokeWidth="1" fill="none" strokeLinecap="round" />
                </>
            )}
            {kind === 'marmot' && (
                <>
                    <circle cx="20" cy="20" r="20" fill="#A3ECD6" />
                    <circle cx="11.5" cy="12.5" r="3.2" fill="#8C6A4A" />
                    <circle cx="28.5" cy="12.5" r="3.2" fill="#8C6A4A" />
                    <circle cx="11.5" cy="12.5" r="1.5" fill="#E7C9A8" />
                    <circle cx="28.5" cy="12.5" r="1.5" fill="#E7C9A8" />
                    <ellipse cx="20" cy="21.5" rx="11" ry="10.5" fill="#A9825C" />
                    <ellipse cx="20" cy="25.5" rx="7.5" ry="6" fill="#EBD3B6" />
                    {eyes(19.5)}
                    <ellipse cx="20" cy="24" rx="1.6" ry="1.1" fill="#5A3E28" />
                    <rect x="18.6" y="26.8" width="1.3" height="2.2" rx="0.4" fill="#fff" />
                    <rect x="20.1" y="26.8" width="1.3" height="2.2" rx="0.4" fill="#fff" />
                </>
            )}
        </svg>
    );
}
