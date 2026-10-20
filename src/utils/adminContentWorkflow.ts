export function createAdminContentTask() {
    let task = '';
    return {
        busy: () => !!task,
        begin(kind: 'upload' | 'save' | 'list') {
            if (task) return null;
            task = kind;
            let ended = false;
            return () => { if (!ended) { ended = true; task = ''; } };
        },
    };
}

/** Apply at completion to the current array, retaining all intervening edits. */
export function withUploadedImage<T extends { id: string }>(rows: T[], id: string, field: string, url: string): T[] {
    return rows.map(row => row.id === id ? { ...row, [field]: url } : row);
}

export function moveAdminRow<T>(rows: T[], index: number, step: number): T[] {
    const target = index + step;
    if (index < 0 || target < 0 || index >= rows.length || target >= rows.length) return rows;
    const next = [...rows]; [next[index], next[target]] = [next[target], next[index]];
    return next;
}
