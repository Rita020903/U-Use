"use client";
import { Campus } from "../lib/types";
import { places, placeFor } from "../lib/places";
export default function PlaceField({
  campus,
  locationId,
  spot,
  onChange,
}: {
  campus: Campus;
  locationId: string;
  spot: string;
  onChange: (id: string, spot: string) => void;
}) {
  return (
    <>
      <label>
        公共交付地点
        <select
          name="locationId"
          value={locationId}
          onChange={(e) =>
            onChange(e.target.value, placeFor(e.target.value)?.label || "")
          }
        >
          <option value="">其他公共地点</option>
          {places
            .filter((p) => p.campus === campus)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
        </select>
      </label>
      <label>
        {locationId ? "交付地点" : "具体公共地点"}
        <input
          required
          name="spot"
          value={spot}
          maxLength={120}
          readOnly={!!locationId}
          onChange={(e) => onChange("", e.target.value)}
          placeholder={
            campus === "TAICANG"
              ? "例如 A 栋公共入口，请勿填写私人房间"
              : "楼宇代码与公共入口"
          }
        />
      </label>
    </>
  );
}
