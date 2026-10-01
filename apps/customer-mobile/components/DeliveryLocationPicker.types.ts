export type DeliveryCoordinate = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export interface DeliveryLocationPickerProps {
  value?: DeliveryCoordinate | null;
  onChange: (coordinate: DeliveryCoordinate) => void;
  compact?: boolean;
}
