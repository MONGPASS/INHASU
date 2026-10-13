import { createContext, useContext } from 'react';

export interface MobileShellValue {
    /** Offset (px) for a page's own sticky bar: just below the shell header (and back bar, when shown). */
    stickyTop: number;
}

export const MobileShellContext = createContext<MobileShellValue>({ stickyTop: 63 });

export const useMobileShell = () => useContext(MobileShellContext);
