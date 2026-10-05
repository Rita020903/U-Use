export type Campus = "SIP" | "TAICANG";

export type AccessMode = "buy" | "borrow" | "rent" | "swap";
export type ProductStatus =
  | "草稿"
  | "审核中"
  | "可用"
  | "已预约"
  | "使用中"
  | "待归还"
  | "已归还"
  | "已下架"
  | "审核拒绝";
export type BookingStatus =
  | "待确认"
  | "已确认"
  | "已交付"
  | "使用中"
  | "待归还"
  | "已归还"
  | "有争议"
  | "已完成"
  | "已取消";
export type ReportStatus = "待处理" | "处理中" | "已处理";

export type Product = {
  id: string;
  createdAt?: string;
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

export type Booking = {
  id: string;
  productId: string;
  productTitle: string;
  campus: Campus;
  spot: string;
  time: string;
  returnTime: string;
  note: string;
  requester: string;
  owner: string;
  depositSnapshot: number;
  returnRequiredSnapshot?: boolean;
  accessModeSnapshot?: AccessMode;
  status: BookingStatus;
  createdAt: string;
};

export type Report = {
  id: string;
  target: string;
  reason: string;
  note: string;
  status: ReportStatus;
  createdAt: string;
};
