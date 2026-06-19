import dayjs from 'dayjs';
import type { ImplantInfo, UsageRecord, LockRecord } from '@/types/implant';

export const mockImplants: ImplantInfo[] = [
  {
    id: 'impl_001',
    barcode: '6901234567890',
    brand: 'Straumann',
    spec: 'SLActive 4.1x10mm',
    batchNo: 'STM2024001',
    expiryDate: dayjs().add(365, 'day').format('YYYY-MM-DD'),
    supplier: '士卓曼',
    quantity: 20,
    inboundDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    status: 'locked',
    usedQuantity: 5,
    lockedQuantity: 2
  },
  {
    id: 'impl_002',
    barcode: '6901234567891',
    brand: 'Nobel',
    spec: 'Active 4.3x11.5mm',
    batchNo: 'NBL2024015',
    expiryDate: dayjs().add(90, 'day').format('YYYY-MM-DD'),
    supplier: '诺保科',
    quantity: 15,
    inboundDate: dayjs().subtract(60, 'day').format('YYYY-MM-DD'),
    status: 'partial_used',
    usedQuantity: 8,
    lockedQuantity: 0
  },
  {
    id: 'impl_003',
    barcode: '6901234567892',
    brand: 'Dentium',
    spec: 'SuperLine 4.0x10mm',
    batchNo: 'DTM2024008',
    expiryDate: dayjs().add(540, 'day').format('YYYY-MM-DD'),
    supplier: '登腾',
    quantity: 30,
    inboundDate: dayjs().subtract(15, 'day').format('YYYY-MM-DD'),
    status: 'in_stock',
    usedQuantity: 0,
    lockedQuantity: 0
  },
  {
    id: 'impl_004',
    barcode: '6901234567893',
    brand: 'Osstem',
    spec: 'TS III 4.5x10mm',
    batchNo: 'OST2024023',
    expiryDate: dayjs().subtract(10, 'day').format('YYYY-MM-DD'),
    supplier: '奥齿泰',
    quantity: 10,
    inboundDate: dayjs().subtract(100, 'day').format('YYYY-MM-DD'),
    status: 'in_stock',
    usedQuantity: 0,
    lockedQuantity: 0
  },
  {
    id: 'impl_005',
    barcode: '6901234567894',
    brand: 'Straumann',
    spec: 'BLX 3.75x12mm',
    batchNo: 'STM2024001',
    expiryDate: dayjs().add(720, 'day').format('YYYY-MM-DD'),
    supplier: '士卓曼',
    quantity: 25,
    inboundDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    status: 'locked',
    usedQuantity: 3,
    lockedQuantity: 1
  },
  {
    id: 'impl_006',
    barcode: '6901234567895',
    brand: 'Straumann',
    spec: 'SLActive 4.1x12mm',
    batchNo: 'STM2024001',
    expiryDate: dayjs().add(300, 'day').format('YYYY-MM-DD'),
    supplier: '士卓曼',
    quantity: 15,
    inboundDate: dayjs().subtract(20, 'day').format('YYYY-MM-DD'),
    status: 'in_stock',
    usedQuantity: 2,
    lockedQuantity: 0
  }
];

export const mockUsageRecords: UsageRecord[] = [
  {
    id: 'use_001',
    implantId: 'impl_001',
    batchNo: 'STM2024001',
    brand: 'Straumann',
    spec: 'SLActive 4.1x10mm',
    doctor: '张医生',
    patientInitial: '王',
    patientId: 'HL2024001',
    surgeryDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    quantity: 1,
    operator: '李护士',
    usedAt: dayjs().subtract(7, 'day').format('YYYY-MM-DD HH:mm')
  },
  {
    id: 'use_002',
    implantId: 'impl_001',
    batchNo: 'STM2024001',
    brand: 'Straumann',
    spec: 'SLActive 4.1x10mm',
    doctor: '李医生',
    patientInitial: '刘',
    patientId: 'HL2024002',
    surgeryDate: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    quantity: 2,
    operator: '王护士',
    usedAt: dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm')
  },
  {
    id: 'use_003',
    implantId: 'impl_002',
    batchNo: 'NBL2024015',
    brand: 'Nobel',
    spec: 'Active 4.3x11.5mm',
    doctor: '王医生',
    patientInitial: '陈',
    patientId: 'HL2024003',
    surgeryDate: dayjs().subtract(10, 'day').format('YYYY-MM-DD'),
    quantity: 3,
    operator: '张护士',
    usedAt: dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm')
  },
  {
    id: 'use_004',
    implantId: 'impl_002',
    batchNo: 'NBL2024015',
    brand: 'Nobel',
    spec: 'Active 4.3x11.5mm',
    doctor: '张医生',
    patientInitial: '赵',
    patientId: 'HL2024004',
    surgeryDate: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
    quantity: 1,
    operator: '李护士',
    usedAt: dayjs().subtract(5, 'day').format('YYYY-MM-DD HH:mm')
  },
  {
    id: 'use_005',
    implantId: 'impl_005',
    batchNo: 'STM2024001',
    brand: 'Straumann',
    spec: 'BLX 3.75x12mm',
    doctor: '刘医生',
    patientInitial: '孙',
    patientId: 'HL2024005',
    surgeryDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    quantity: 3,
    operator: '王护士',
    usedAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm')
  }
];

export const mockLockRecords: LockRecord[] = [
  {
    id: 'lock_001',
    implantId: 'impl_001',
    batchNo: 'STM2024001',
    brand: 'Straumann',
    spec: 'SLActive 4.1x10mm',
    doctor: '张医生',
    patientInitial: '周',
    patientId: 'HL2024006',
    surgeryDate: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    quantity: 2,
    operator: '李护士',
    lockedAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm'),
    status: 'locked'
  },
  {
    id: 'lock_002',
    implantId: 'impl_005',
    batchNo: 'STM2024001',
    brand: 'Straumann',
    spec: 'BLX 3.75x12mm',
    doctor: '王医生',
    patientInitial: '吴',
    patientId: 'HL2024007',
    surgeryDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
    quantity: 1,
    operator: '张护士',
    lockedAt: dayjs().subtract(6, 'hour').format('YYYY-MM-DD HH:mm'),
    status: 'locked'
  }
];
