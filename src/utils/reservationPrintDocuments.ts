/**
 * 예약 관리에서 만드는 인쇄·내려받기 문서 — 관리자 화면이 아니다.
 * - 현지(몽골) 숙소 담당자용 수배서 인쇄(몽골어 라벨)
 * - 숙소 수배 Excel(.xls로 여는 HTML 표) — 예약 한 건·목록 전체
 * - 공항 미팅용 가이드 피켓 PNG(고정 디자인 위에 고객명·기간 합성)
 * 새 창·파일에는 관리자 디자인 변수(--adm-*)가 없으므로 문서 자체의 색·크기를 그대로 적는다(관리자 디자인 점검 대상 밖).
 * 2026-11-24 AdminReservationManage.tsx에서 내용 그대로 옮겼다.
 */

export const escHtml = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));

export interface BookingSheetTraveler { passportName?: string; name?: string; birthdate?: string; gender?: string; phone?: string }
export interface BookingSheetPrint {
    number: string; product: string; period: string; arrival: string; departure: string;
    nightsMn: string; peopleMn: string; totalMn: string; depositMn: string; balanceMn: string; signedMn: string; brandNameEn: string;
    travelers: BookingSheetTraveler[]; memos: string[];
}

/** 수배서 PDF는 현지(몽골) 담당자용 — 라벨은 몽골어. 데이터(이름·날짜·금액 등)는 원본 유지. */
const genderMn = (g: unknown) => {
    const s = String(g || '').trim();
    if (/女|여성|female|^f$/i.test(s)) return 'Эмэгтэй';
    if (/男|남성|male|^m$/i.test(s)) return 'Эрэгтэй';
    return s || '-';
};

export function bookingSheetHtml(d: BookingSheetPrint): string {
    const esc = escHtml;
    const cell = (v: unknown) => esc(v || '-');
    const travelerRows = d.travelers.map((t, i) => `
            <tr>
                <td class="c">${i + 1}</td>
                <td class="up b">${cell((t.passportName || '').toUpperCase())}</td>
                <td>${cell(t.name)}</td>
                <td class="c">${cell(t.birthdate)}</td>
                <td class="c">${esc(genderMn(t.gender))}</td>
                <td>${cell(t.phone)}</td>
            </tr>`).join('');
    const memoBlock = d.memos.length ? `
            <h2>Тэмдэглэл</h2>
            <ul style="margin:0;padding-left:18px">${d.memos.map((m) => `<li style="margin:4px 0;font-size:12.5px;line-height:1.5;white-space:pre-wrap">${esc(m)}</li>`).join('')}</ul>` : '';
    return `<!doctype html><html lang="mn"><head><meta charset="utf-8"><title>Зочид буудлын захиалга ${esc(d.number)}</title>
        <style>
          *{box-sizing:border-box} body{font-family:'Noto Sans','Arial','Malgun Gothic',sans-serif;color:#111;margin:0;padding:28px 32px}
          h1{font-size:20px;margin:0 0 4px} .sub{color:#666;font-size:12px;margin:0 0 18px}
          .meta{width:100%;border-collapse:collapse;margin-bottom:18px}
          .meta td{border:1px solid #d7dee8;padding:8px 10px;font-size:13px}
          .meta td.k{background:#eef4ff;color:#1656d6;font-weight:700;width:135px;white-space:nowrap}
          h2{font-size:14px;margin:18px 0 8px;color:#0b1b45;border-left:4px solid #287dfa;padding-left:8px}
          table{width:100%;border-collapse:collapse} th,td{border:1px solid #d7dee8;padding:7px 9px;font-size:12.5px;text-align:left}
          th{background:#f4f8ff;color:#0b1b45;font-weight:700} td.c{text-align:center} td.b{font-weight:700} td.up{text-transform:uppercase}
          .foot{margin-top:22px;color:#888;font-size:11px;border-top:1px solid #e5e9f0;padding-top:10px}
          @media print{body{padding:0} @page{margin:14mm}}
        </style></head><body>
          <h1>Зочид буудлын захиалгын хүсэлт</h1>
          <p class="sub">${esc(d.brandNameEn)} · Захиалгын дугаар: ${esc(d.number)}</p>
          <table class="meta">
            <tr><td class="k">Аяллын нэр</td><td colspan="3">${esc(d.product)}</td></tr>
            <tr><td class="k">Аяллын хугацаа</td><td>${esc(d.period)}${d.nightsMn ? ` <b>(${esc(d.nightsMn)})</b>` : ''}</td><td class="k">Хүний тоо</td><td>${esc(d.peopleMn)}</td></tr>
            <tr><td class="k">Ирэх нислэг</td><td colspan="3">${esc(d.arrival)}</td></tr>
            <tr><td class="k">Буцах нислэг</td><td colspan="3">${esc(d.departure)}</td></tr>
            <tr><td class="k">Аяллын төлбөр</td><td class="b">${esc(d.totalMn)}</td><td class="k">Урьдчилгаа / Үлдэгдэл</td><td>${esc(d.depositMn)} / ${esc(d.balanceMn)}</td></tr>
          </table>
          <h2>Аялагчдын жагсаалт</h2>
          <table><thead><tr><th style="width:36px">№</th><th>Паспортын нэр</th><th>Нэр</th><th style="width:120px">Төрсөн огноо</th><th style="width:70px">Хүйс</th><th style="width:150px">Холбоо барих</th></tr></thead>
          <tbody>${travelerRows}</tbody></table>
          ${memoBlock}
          <p class="foot">Цахим гарын үсэг: ${esc(d.signedMn)} · Хэвлэсэн өдрийн байдлаарх мэдээлэл. Хувийн мэдээлэл агуулсан тул анхааралтай хадгална уу.</p>
        </body></html>`;
}

/** 숙소 수배 Excel: 첫 줄 요약 칸 + 머리·줄 표(Excel이 HTML 표로 연다) */
export function lodgeSheetExcelHtml<Row extends Record<string, unknown>>(metaCells: string[], headers: Array<[keyof Row, string]>, rows: Row[]): string {
    const esc = escHtml;
    const tableRows = rows.map((row) => `<tr>${headers.map(([key]) => `<td>${esc(row[key])}</td>`).join('')}</tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8">
        <style>
          table{border-collapse:collapse;font-family:Arial,'Malgun Gothic',sans-serif;font-size:11pt}
          th{background:#0f766e;color:#fff;font-weight:700;border:1px solid #0b5f59;padding:6px 8px;white-space:nowrap}
          td{border:1px solid #cbd5e1;padding:6px 8px;white-space:pre-wrap;vertical-align:top}
          .meta td{background:#f8fafc;font-weight:700}
        </style></head><body>
          <table class="meta"><tr>${metaCells.map(cell => `<td>${cell}</td>`).join('')}</tr></table>
          <br>
          <table><thead><tr>${headers.map(([, label]) => `<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
        </body></html>`;
}

/** 내려받기: Excel용 HTML을 .xls 파일로 */
export function downloadExcelHtml(html: string, fileName: string): void {
    const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

/** 공항 미팅용 가이드 피켓: 고정 디자인 위에 고객명(민트 그라데이션 타이포, 길면 자동 축소)과 기간(하단 플라크)을 그린다 */
export function drawGuidePicket(template: HTMLImageElement, customerName: string, period: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = template.naturalWidth;
    canvas.height = template.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이미지 생성 기능을 사용할 수 없습니다.');
    ctx.drawImage(template, 0, 0);

    // 고객명: 첨부 피켓처럼 포스터 중앙을 가득 채운 민트 그라데이션 타이포. 긴 이름은 한 줄에 들어올 때까지 자동 축소한다.
    const nameMaxWidth = canvas.width * 0.92;
    let nameFontSize = Math.round(canvas.width * 0.17);
    const nameFontFamily = '"Arial Black", Impact, "Pretendard", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${nameFontSize}px ${nameFontFamily}`;
    while (ctx.measureText(customerName).width > nameMaxWidth && nameFontSize > 62) {
        nameFontSize -= 2;
        ctx.font = `900 ${nameFontSize}px ${nameFontFamily}`;
    }
    const nameY = canvas.height * 0.625;
    const nameGradient = ctx.createLinearGradient(0, nameY - nameFontSize * 0.58, 0, nameY + nameFontSize * 0.58);
    nameGradient.addColorStop(0, '#F7FFFD');
    nameGradient.addColorStop(0.38, '#D2F8F1');
    nameGradient.addColorStop(1, '#5CCDBB');
    ctx.save();
    ctx.shadowColor = 'rgba(0, 18, 20, 0.72)';
    ctx.shadowBlur = Math.max(4, canvas.width * 0.004);
    ctx.shadowOffsetY = Math.max(4, canvas.height * 0.004);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, canvas.width * 0.0015);
    ctx.strokeStyle = 'rgba(226, 255, 250, 0.34)';
    ctx.fillStyle = nameGradient;
    ctx.strokeText(customerName, canvas.width / 2, nameY, nameMaxWidth);
    ctx.fillText(customerName, canvas.width / 2, nameY, nameMaxWidth);
    ctx.restore();

    // 날짜: 하단 검정 플라크 정중앙.
    const dateMaxWidth = canvas.width * 0.31;
    let dateFontSize = Math.round(canvas.width * 0.033);
    ctx.font = `900 ${dateFontSize}px "Arial Black", Arial, sans-serif`;
    while (ctx.measureText(period).width > dateMaxWidth && dateFontSize > 26) {
        dateFontSize -= 1;
        ctx.font = `900 ${dateFontSize}px "Arial Black", Arial, sans-serif`;
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8DE6D5';
    ctx.shadowColor = 'rgba(115, 239, 216, 0.22)';
    ctx.shadowBlur = Math.max(2, canvas.width * 0.002);
    ctx.shadowOffsetY = 1;
    ctx.fillText(period, canvas.width / 2, canvas.height * 0.79, dateMaxWidth);
    ctx.restore();
    return canvas;
}
