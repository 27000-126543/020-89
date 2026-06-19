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
  adjustedQuantity: number;
}

export interface LockRecord {
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
  lockedAt: string;
  status: 'locked' | 'used' | 'cancelled';
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
  lockRecordId?: string;
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
  lockRecords: LockRecord[];
  adjustmentRecords: AdjustmentRecord[];
  stockInfo: {
    totalQuantity: number;
    usedQuantity: number;
    lockedQuantity: number;
    adjustedQuantity: number;
    availableQuantity: number;
  };
}

export interface BatchSummary {
  batchNo: string;
  implants: ImplantInfo[];
  usageRecords: UsageRecord[];
  lockRecords: LockRecord[];
  adjustmentRecords: AdjustmentRecord[];
  totalStock: {
    totalQuantity: number;
    usedQuantity: number;
    usedCaseCount: number;
    usedQuantityFromRecords: number;
    lockedQuantity: number;
    adjustedQuantity: number;
    availableQuantity: number;
  };
  uniqueSpecs: string[];
  uniqueSuppliers: string[];
}

export type AlertType = 'expiry_expired' | 'expiry_near' | 'stock_low';

export type AdjustmentType = 'inventory_loss' | 'damage' | 'return' | 'other';

export interface AdjustmentRecord {
  id: string;
  implantId: string;
  batchNo: string;
  brand: string;
  spec: string;
  type: AdjustmentType;
  quantity: number;
  reason: string;
  operator: string;
  adjustedAt: string;
}

export interface InventoryGroup {
  key: string;
  brand: string;
  spec: string;
  batchNo: string;
  implants: ImplantInfo[];
  openingQuantity: number;
  inboundQuantity: number;
  usedQuantity: number;
  lockedQuantity: number;
  adjustedQuantity: number;
  availableQuantity: number;
  closingQuantity: number;
  difference: number;
}

export interface InventoryDetail {
  implantId: string;
  inboundDate: string;
  expiryDate: string;
  supplier: string;
  totalQuantity: number;
  usedQuantity: number;
  lockedQuantity: number;
  adjustedQuantity: number;
  availableQuantity: number;
  usageRecords: UsageRecord[];
  lockRecords: LockRecord[];
  adjustmentRecords: AdjustmentRecord[];
}

export interface SurgeryStockpile {
  surgeryDate: string;
  doctor: string;
  patientInitial: string;
  patientId: string;
  brand: string;
  spec: string;
  requiredQuantity: number;
  availableBatches: {
    implantId: string;
    batchNo: string;
    expiryDate: string;
    availableQuantity: number;
  }[];
  totalAvailable: number;
  hasShortage: boolean;
  shortageQuantity: number;
  lockedImplantId?: string;
  lockedBatchNo?: string;
  lockRecordId?: string;
  status: 'pending' | 'locked' | 'partial';
}

export interface StockpileFilter {
  dateRange: 'today' | 'tomorrow' | 'week';
  doctor?: string;
}


export interface AlertItem {
  id: string;
  type: AlertType;
  level: 'error' | 'warning';
  title: string;
  message: string;
  batchNo: string;
  brand: string;
  spec: string;
  implantId: string;
  expiryDate?: string;
  daysLeft?: number;
  availableQuantity?: number;
  totalQuantity?: number;
}

export interface AlertSummary {
  total: number;
  expired: number;
  nearExpiry: number;
  lowStock: number;
  items: AlertItem[];
}

export const DOCTORS = ['张医生', '李医生', '王医生', '刘医生', '陈医生'];
export const SUPPLIERS = ['士卓曼', '诺保科', '登腾', '奥齿泰', '百康特'];
export const BRANDS = ['Straumann', 'Nobel', 'Dentium', 'Osstem', 'Bicon'];
