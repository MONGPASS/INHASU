import type { PriceBreakdown } from '../components/reservation-shared/bookingShared';

/** Read the saved booking, including legacy aliases, without repricing its product. */
export function savedReservationPricing(reservation: Record<string, any>): PriceBreakdown {
    const prices = reservation.priceBreakdown ?? reservation.price_breakdown;
    const total = prices?.total ?? reservation.totalPrice ?? reservation.total_price ?? reservation.totalAmount ?? 0;
    const deposit = prices?.deposit ?? reservation.depositAmount ?? reservation.deposit_amount ?? reservation.deposit ?? 0;
    const local = prices?.local ?? reservation.balanceAmount ?? reservation.balance_amount ?? reservation.balance
        ?? Math.max(0, total - deposit);
    return { total, deposit, local };
}
