export type Presence = {
  lat: number;
  lng: number;
  campus: "SIP" | "TAICANG";
  updatedAt: number;
  personId: string;
  leaseId: string;
};
export const PRESENCE_TTL = 120000;
export function coarsePosition(lat: number, lng: number) {
  return { lat: Math.round(lat * 500) / 500, lng: Math.round(lng * 500) / 500 };
}
