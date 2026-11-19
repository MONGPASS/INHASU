import { escapeDocumentText } from './document-safe.js';

const displayText = value => escapeDocumentText(String(value ?? '').trim() || '—');
const won = new Intl.NumberFormat('ko-KR');

function amountLabel(value) {
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) return '미입력';
    value = Number(raw.replaceAll(',', ''));
  }
  return Number.isFinite(value) && value >= 0 ? won.format(value) + '원' : '미입력';
}

function paymentStatus(value, paid, unpaid) {
  if (value === 'paid' || value === true) return paid;
  if (value === 'unpaid' || value === false) return unpaid;
  return displayText(value);
}

// 상품 예약과 맞춤 견적 예약에서 저장한 금액을 같은 가이드용 양식으로 출력한다.
export function guideStatementContent(details) {
  const packageName = details.packageType === 'full' ? '풀패키지' : details.packageType === 'value' ? '실속' : '';
  const travelers = Number(details.travelers);
  const note = typeof details.note === 'string' ? details.note.trim() : '';
  return `<header class="gs-statement-head">
    <h2>거래명세서</h2>
    <p>발행일 <strong>${displayText(details.issueDate)}</strong></p>
  </header>
  <dl class="gs-statement-parties">
    <div><dt>공급자</dt><dd>몽골리아 은하수</dd></div>
    <div><dt>예약자</dt><dd>${displayText(details.customerName)}</dd></div>
    <div><dt>예약 번호</dt><dd>${displayText(details.reservationNumber)}</dd></div>
    <div><dt>여행 기간</dt><dd>${displayText(details.period)}</dd></div>
  </dl>
  <table class="gs-statement-table">
    <caption>거래 내역</caption>
    <thead><tr><th scope="col">여행상품</th><th scope="col">인원</th><th scope="col">총 여행경비</th></tr></thead>
    <tbody><tr><th scope="row">${displayText(details.productName)}${packageName ? `<small>${packageName}</small>` : ''}</th>
      <td>${Number.isInteger(travelers) && travelers > 0 ? travelers + '명' : '—'}</td>
      <td class="gs-statement-total">${amountLabel(details.totalAmount)}</td></tr></tbody>
  </table>
  <table class="gs-statement-table">
    <caption>결제 내역</caption>
    <thead><tr><th scope="col">구분</th><th scope="col">금액</th><th scope="col">처리 상태</th></tr></thead>
    <tbody>
      <tr><th scope="row">예약금</th><td>${amountLabel(details.depositAmount)}</td><td>${paymentStatus(details.depositStatus, '입금완료', '미입금')}</td></tr>
      <tr><th scope="row">현지 잔금</th><td>${amountLabel(details.balanceAmount)}</td><td>${paymentStatus(details.balanceStatus, '수령완료', '미수령')}</td></tr>
    </tbody>
  </table>
  ${note ? `<div class="gs-statement-note"><h3>계약 비고</h3><p>${displayText(note)}</p></div>` : ''}`;
}
