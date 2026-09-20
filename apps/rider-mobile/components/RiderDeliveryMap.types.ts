export interface RiderDeliveryMapProps {
  deliveryId?: string | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  pickupAddress?: string | null;
  dropoffLatitude?: number | null;
  dropoffLongitude?: number | null;
  dropoffAddress?: string | null;
  status?: string | null;
  trackRider?: boolean;
}
