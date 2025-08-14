export interface VehicleLocation {
  lat: number;
  lon: number;
}

export interface Vehicle {
  id: string; // internal ID or VIN
  displayName?: string;
  location: VehicleLocation;
  batteryLevel?: number;
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}