// Pages preview assets can ignore Range requests. Supply byte ranges for this
// bounded (16.9 MB) video so browsers can seek without downloading it in full.
export const onRequestGet: PagesFunction = async (context) => {
    const response = await context.next();
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('video/mp4')) return response;

    const headers = new Headers(response.headers);
    headers.set('Accept-Ranges', 'bytes');
    const range = context.request.headers.get('Range');
    if (!range) return new Response(response.body, { status: response.status, headers });

    const bytes = await response.arrayBuffer();
    const size = bytes.byteLength;
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    let start = match?.[1] ? Number(match[1]) : 0;
    let end = match?.[2] ? Number(match[2]) : size - 1;
    if (match && !match[1] && match[2]) {
        start = Math.max(0, size - Number(match[2]));
        end = size - 1;
    }
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
        headers.set('Content-Range', `bytes */${size}`);
        headers.set('Content-Length', '0');
        return new Response(null, { status: 416, headers });
    }
    end = Math.min(end, size - 1);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(bytes.slice(start, end + 1), { status: 206, headers });
};
