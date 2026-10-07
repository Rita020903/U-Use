import { Campus } from "./types";
export type Place = {
  id: string;
  campus: Campus;
  label: string;
  building: string;
  offCampus?: boolean;
};
export const places: Place[] = [
  { id: "sip-cb", campus: "SIP", label: "CB 中心楼公共入口", building: "CB" },
  { id: "sip-bs", campus: "SIP", label: "BS 商学院公共入口", building: "BS" },
  {
    id: "sip-library",
    campus: "SIP",
    label: "图书馆公共入口（中心楼）",
    building: "CB",
  },
  {
    id: "sip-parfait",
    campus: "SIP",
    label: "校外 · 芭菲国际公寓公共入口",
    building: "",
    offCampus: true,
  },
  ...["A", "B", "C", "D", "E", "F", "G"].map((building) => ({
    id: "tc-" + building.toLowerCase(),
    campus: "TAICANG" as const,
    label: building + " 栋公共入口",
    building,
  })),
  {
    id: "tc-library",
    campus: "TAICANG",
    label: "D 栋图书馆公共入口",
    building: "D",
  },
  {
    id: "tc-student",
    campus: "TAICANG",
    label: "J 栋学生中心公共入口",
    building: "J",
  },
  {
    id: "tc-residence",
    campus: "TAICANG",
    label: "校外 · 西浦创业家公寓公共入口（太仓大道115号）",
    building: "",
    offCampus: true,
  },
];
export function placeFor(id?: string) {
  return places.find((p) => p.id === id);
}
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180,
    dLat = (b.lat - a.lat) * rad,
    dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
