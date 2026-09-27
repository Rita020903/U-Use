export type Campus = "SIP" | "TAICANG";

export type AccessMode = "buy" | "borrow" | "rent" | "swap";
export type ProductStatus = "草稿" | "审核中" | "可用" | "已预约" | "使用中" | "待归还" | "已归还" | "已下架" | "审核拒绝";

export type Product = {
  id: string;
  title: string;
  price: number;
  campus: Campus;
  spot: string;
  distanceKm: number;
  category: string;
  condition: string;
  emoji: string;
  tone: string;
  crossCampus: boolean;
  accessMode: AccessMode;
  deposit: number;
  rentPrice?: number;
  availableFrom: string;
  availableTo: string;
  availabilityLabel: string;
  returnRequired: boolean;
  returnRule: string;
  agreement: string[];
  status: ProductStatus;
};
