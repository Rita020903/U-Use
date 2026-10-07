import { Campus } from "./types";

export const campuses = {
  SIP: {
    label: "苏州工业园区校区",
    map: "https://www.xjtlu.edu.cn/wp-content/uploads/2026/03/Image-XJTLU-SIP-Campus-Map-March2026-v2-scaled.jpg",
    download:
      "https://www.xjtlu.edu.cn/wp-content/uploads/2026/03/XJTLU-SIP-Campus-Map-March2026-v2.pdf",
    query: "西交利物浦大学 苏州工业园区 仁爱路111号",
  },
  TAICANG: {
    label: "XEC 校区",
    map: "https://www.xjtlu.edu.cn/wp-content/uploads/2025/03/campus-map.jpg",
    download:
      "https://www.xjtlu.edu.cn/wp-content/uploads/2025/03/campus-map.jpg",
    query: "西交利物浦大学 太仓校区",
  },
} satisfies Record<
  Campus,
  { label: string; map: string; download: string; query: string }
>;

export function navigationUrl(campus: Campus, spot = "") {
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(`${campuses[campus].query} ${spot}`)}&city=苏州&view=map`;
}
