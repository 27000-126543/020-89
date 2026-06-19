export interface ImplantInfo {
  id: string;
  barcode: string;
  brand: string;
  spec: string;
  batchNo: string;
  expiryDate: string;
  supplier: string;
  quantity: number;
  inboundDate: string;
  status: 'pending' | 'in_stock' | 'partial_used' | 'fully_used' | 'locked';
  usedQuantity: number;
  lockedQuantity: number;
}

export interface UsageRecord {
  id: string;
  implantId: string;
  batchNo: string;
  brand: string;
  spec: string;
  doctor: string;
  patientInitial: string;
  patientId: string;
  surgeryDate: string;
  quantity: number;
  operator: string;
  usedAt: string;
}

export interface PendingItem {
  id: string;
  barcode: string;
  brand: string;
  spec: string;
  batchNo: string;
  expiryDate: string;
  supplier: string;
  quantity: number;
  warnings: ValidationWarning[];
}

export interface ValidationWarning {
  type: 'batch_duplicate' | 'expiry_near' | 'expiry_expired';
  message: string;
  level: 'error' | 'warning';
}

export interface BatchDetail {
  implant: ImplantInfo;
  usageRecords: UsageRecord[];
  stockInfo: {
    totalQuantity: number;
    usedQuantity: number;
    lockedQuantity: number;
    availableQuantity: number;
  };
}

export const DOCTORS = ['张医生', '李医生', '王医生', '刘医生', '陈医生'];
export const SUPPLIERS = ['士卓曼', '诺保科', '登腾', '奥齿泰', '百康特'];
export const BRANDS = ['Straumann', 'Nobel', 'Dentium', 'Osstem', 'Bicon'];
