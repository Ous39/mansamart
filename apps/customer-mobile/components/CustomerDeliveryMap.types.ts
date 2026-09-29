export interface CustomerDeliveryMapProps {
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropoffLatitude?: number | null;
  dropoffLongitude?: number | null;
  status?: string | null;
  riderLocation?: {
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    createdAt?: string | null;
  } | null;
}
