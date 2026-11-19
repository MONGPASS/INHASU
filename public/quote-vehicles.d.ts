export interface QuoteVehicle {
  name: string;
  seats: string;
  luggage: string;
  description: string;
  photos: string[];
}
export function loadQuoteVehicles(signal?: AbortSignal): Promise<QuoteVehicle[]>;
export function quoteVehicleCards(vehicles: QuoteVehicle[], quoteModel?: string): string;
