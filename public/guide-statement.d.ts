export interface GuideStatementPayment {
  totalAmount?: number | string | null;
  depositAmount?: number | string | null;
  balanceAmount?: number | string | null;
  depositStatus?: string | boolean | null;
  balanceStatus?: string | boolean | null;
  packageType?: string | null;
  note?: string | null;
}

export function guideStatementContent(details: GuideStatementPayment & {
  customerName: string;
  reservationNumber: string;
  productName: string;
  travelers: number;
  period: string;
  issueDate: string;
}): string;
