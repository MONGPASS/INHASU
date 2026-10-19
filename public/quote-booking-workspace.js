/* Shared administrator workflow projection. Original booking APIs remain authoritative. */
(function (global) {
  function snapshot(record, booking, stats) {
    const days = Array.isArray(booking?.days) ? booking.days : [], ci = booking?.contractInfo || {};
    const travelers = Array.isArray(booking?.travelers) ? booking.travelers : [];
    const expected = (Number(record?.adult) || 0) + (Number(record?.child) || 0) + (Number(record?.infant) || 0);
    return { bookingId: String(record?.id || ''), cancelled: /취소|cancelled/i.test(record?.status || ''),
      accepted: record?.decision?.status === 'accepted' || record?.status === '예약확정',
      deposit: ci.depositStatus === '입금완료', signed: !!booking?.contract?.signedAt,
      confirmed: record?.status === '예약확정', schedule: days.length > 0, dayCount: days.length,
      published: booking?.publishStatus === 'published', guideReady: !!stats?.guideOk, vehicleReady: !!stats?.vehicleOk,
      lodgeCount: Number(stats?.lodgeCount) || 0, lodgeNeeded: Number(stats?.lodgeNeeded) || 0,
      travelerCount: travelers.filter(person => person && (person.nameKo || person.passportName)).length, expectedTravelers: expected };
  }
  const sections = { docs: ['documentsSection'], info: ['bookingInfoSection'], pay: ['paymentSection', 'ci_depositStatus'],
    assign: ['assignmentSection', 'g_pick'], guide: ['g_pick'], vehicle: ['v_pick'], stay: ['lodgeWrap'],
    send: ['itineraryNoticeBtn'], log: ['admin-booking-history'], notes: ['bk_memo'] };
  function navigate(section, document) {
    const target = sections[section]; if (!target) return false;
    const element = document.getElementById(target[0]); if (!element) return false;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (target[1]) document.getElementById(target[1])?.focus({ preventScroll: true });
    else if (['guide', 'vehicle', 'send', 'notes'].includes(section)) element.focus?.({ preventScroll: true });
    return true;
  }
  function openCustomer(id, returnTo) {
    if (typeof id !== 'string' || !id) return false;
    if (global.parent && global.parent !== global) global.parent.postMessage({ type:'inhasu-quote-customer-open', version:1, id }, global.location.origin);
    else global.location.assign('/admin/customer-workspace/quote/' + encodeURIComponent(id) + '?returnTo=' + encodeURIComponent(returnTo || '/admin/quote-desk/inbox'));
    return true;
  }
  function notifySaved(id) {
    if (global.parent && global.parent !== global) global.parent.postMessage({ type:'inhasu-quote-record-saved', version:1, id:String(id) }, global.location.origin);
  }
  global.QuoteBookingWorkspace = { snapshot, navigate, openCustomer, notifySaved };
})(typeof window === 'undefined' ? globalThis : window);
