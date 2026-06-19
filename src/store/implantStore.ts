import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import dayjs from 'dayjs';
import type {
  ImplantInfo,
  UsageRecord,
  LockRecord,
  PendingItem,
  BatchDetail,
  BatchSummary,
  AlertItem,
  AlertSummary,
  AlertType,
  AdjustmentRecord,
  AdjustmentType,
  InventoryGroup,
  InventoryDetail,
  SurgeryStockpile
} from '@/types/implant';
import { generateId } from '@/utils/validator';
import { mockImplants, mockUsageRecords, mockLockRecords, mockAdjustmentRecords } from '@/data/mockData';

interface ImplantState {
  implants: ImplantInfo[];
  usageRecords: UsageRecord[];
  lockRecords: LockRecord[];
  adjustmentRecords: AdjustmentRecord[];
  pendingItems: PendingItem[];

  addImplant: (implant: Omit<ImplantInfo, 'id' | 'inboundDate' | 'status' | 'usedQuantity' | 'lockedQuantity' | 'adjustedQuantity'>) => ImplantInfo;
  addPendingItem: (item: Omit<PendingItem, 'id'>) => void;
  removePendingItem: (id: string) => void;
  clearPendingItems: () => void;
  confirmInbound: () => ImplantInfo[];

  createLockRecord: (record: Omit<LockRecord, 'id' | 'lockedAt' | 'status'>) => LockRecord | null;
  confirmLockUsage: (lockRecordId: string) => boolean;
  cancelLockRecord: (lockRecordId: string) => boolean;
  getActiveLockRecords: () => LockRecord[];
  getLockRecordsByImplant: (implantId: string) => LockRecord[];

  confirmUsage: (record: Omit<UsageRecord, 'id' | 'usedAt'>) => boolean;

  getBatchDetail: (batchNo: string) => BatchDetail | null;
  getBatchDetailById: (implantId: string) => BatchDetail | null;
  getBatchSummary: (batchNo: string) => BatchSummary | null;
  searchByBatchNo: (batchNo: string) => ImplantInfo[];
  getAvailableImplants: () => ImplantInfo[];
  getExistingBatchNos: () => string[];
  getBatchNoMatches: (batchNo: string) => { count: number; specs: string[]; inboundDates: string[] };

  getAlerts: () => AlertSummary;
  updateImplantStatus: (implantId: string) => void;

  createAdjustment: (record: Omit<AdjustmentRecord, 'id' | 'adjustedAt'>) => AdjustmentRecord | null;
  getAdjustmentRecordsByImplant: (implantId: string) => AdjustmentRecord[];

  getInventoryGroups: (startDate?: string, endDate?: string) => InventoryGroup[];
  getInventoryDetail: (implantId: string, startDate?: string, endDate?: string) => InventoryDetail | null;
  exportInventory: (groups: InventoryGroup[]) => string;

  getSurgeryStockpiles: (dateRange: 'today' | 'tomorrow' | 'week', doctor?: string) => SurgeryStockpile[];
  batchLockStockpiles: (stockpiles: { surgeryDate: string; doctor: string; patientInitial: string; patientId: string; implantId: string; quantity: number; operator: string; brand: string; spec: string; batchNo: string }[]) => LockRecord[];
}

export const useImplantStore = create<ImplantState>()(
  persist(
    (set, get) => ({
      implants: mockImplants,
      usageRecords: mockUsageRecords,
      lockRecords: mockLockRecords,
      adjustmentRecords: mockAdjustmentRecords,
      pendingItems: [],

      addImplant: (implantData) => {
        const newImplant: ImplantInfo = {
          ...implantData,
          id: generateId(),
          inboundDate: dayjs().format('YYYY-MM-DD'),
          status: 'in_stock',
          usedQuantity: 0,
          lockedQuantity: 0,
          adjustedQuantity: 0
        };
        set((state) => ({
          implants: [...state.implants, newImplant]
        }));
        console.log('[ImplantStore] 新增种植体入库:', newImplant);
        return newImplant;
      },

      addPendingItem: (item) => {
        const newItem: PendingItem = {
          ...item,
          id: generateId()
        };
        set((state) => ({
          pendingItems: [...state.pendingItems, newItem]
        }));
        console.log('[ImplantStore] 新增待上架项:', newItem);
      },

      removePendingItem: (id) => {
        set((state) => ({
          pendingItems: state.pendingItems.filter((item) => item.id !== id)
        }));
        console.log('[ImplantStore] 移除待上架项:', id);
      },

      clearPendingItems: () => {
        set({ pendingItems: [] });
        console.log('[ImplantStore] 清空待上架清单');
      },

      confirmInbound: () => {
        const { pendingItems, addImplant } = get();
        const newImplants: ImplantInfo[] = [];
        pendingItems.forEach((item) => {
          const newImplant = addImplant({
            barcode: item.barcode,
            brand: item.brand,
            spec: item.spec,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            supplier: item.supplier,
            quantity: item.quantity
          });
          newImplants.push(newImplant);
        });
        set({ pendingItems: [] });
        console.log('[ImplantStore] 确认入库完成，共', pendingItems.length, '项');
        return newImplants;
      },

      createLockRecord: (recordData) => {
        const { implants, updateImplantStatus } = get();
        const implant = implants.find((i) => i.id === recordData.implantId);
        if (!implant) {
          console.error('[ImplantStore] 锁定失败：种植体不存在');
          return null;
        }

        const available = implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity;
        if (recordData.quantity > available) {
          console.error('[ImplantStore] 锁定失败：库存不足，可用', available, '需要', recordData.quantity);
          return null;
        }

        const newLockRecord: LockRecord = {
          ...recordData,
          id: generateId(),
          lockedAt: dayjs().format('YYYY-MM-DD HH:mm'),
          status: 'locked'
        };

        set((state) => ({
          lockRecords: [...state.lockRecords, newLockRecord],
          implants: state.implants.map((i) =>
            i.id === recordData.implantId
              ? { ...i, lockedQuantity: i.lockedQuantity + recordData.quantity }
              : i
          )
        }));

        updateImplantStatus(recordData.implantId);
        console.log('[ImplantStore] 创建锁定记录成功:', newLockRecord);
        return newLockRecord;
      },

      confirmLockUsage: (lockRecordId) => {
        const { lockRecords, implants } = get();
        const lockRecord = lockRecords.find((r) => r.id === lockRecordId);
        if (!lockRecord || lockRecord.status !== 'locked') {
          console.error('[ImplantStore] 确认使用失败：锁定记录不存在或已处理');
          return false;
        }

        const implant = implants.find((i) => i.id === lockRecord.implantId);
        if (!implant) {
          console.error('[ImplantStore] 确认使用失败：种植体不存在');
          return false;
        }

        const usageRecord: Omit<UsageRecord, 'id' | 'usedAt'> = {
          implantId: lockRecord.implantId,
          batchNo: lockRecord.batchNo,
          brand: lockRecord.brand,
          spec: lockRecord.spec,
          doctor: lockRecord.doctor,
          patientInitial: lockRecord.patientInitial,
          patientId: lockRecord.patientId,
          surgeryDate: lockRecord.surgeryDate,
          quantity: lockRecord.quantity,
          operator: lockRecord.operator,
          lockRecordId: lockRecord.id
        };

        const newUsageRecord: UsageRecord = {
          ...usageRecord,
          id: generateId(),
          usedAt: dayjs().format('YYYY-MM-DD HH:mm')
        };

        set((state) => ({
          lockRecords: state.lockRecords.map((r) =>
            r.id === lockRecordId ? { ...r, status: 'used' as const } : r
          ),
          usageRecords: [...state.usageRecords, newUsageRecord],
          implants: state.implants.map((i) => {
            if (i.id === lockRecord.implantId) {
              const newUsed = i.usedQuantity + lockRecord.quantity;
              const newLocked = Math.max(0, i.lockedQuantity - lockRecord.quantity);
              const totalUsed = newUsed + newLocked + i.adjustedQuantity;
              let status: ImplantInfo['status'] = 'in_stock';
              if (totalUsed >= i.quantity) status = 'fully_used';
              else if (newUsed > 0) status = 'partial_used';
              return {
                ...i,
                usedQuantity: newUsed,
                lockedQuantity: newLocked,
                status
              };
            }
            return i;
          })
        }));

        console.log('[ImplantStore] 锁定记录转使用成功:', lockRecordId);
        return true;
      },

      cancelLockRecord: (lockRecordId) => {
        const { lockRecords } = get();
        const lockRecord = lockRecords.find((r) => r.id === lockRecordId);
        if (!lockRecord || lockRecord.status !== 'locked') {
          console.error('[ImplantStore] 取消锁定失败：锁定记录不存在或已处理');
          return false;
        }

        set((state) => ({
          lockRecords: state.lockRecords.map((r) =>
            r.id === lockRecordId ? { ...r, status: 'cancelled' as const } : r
          ),
          implants: state.implants.map((i) =>
            i.id === lockRecord.implantId
              ? { ...i, lockedQuantity: Math.max(0, i.lockedQuantity - lockRecord.quantity) }
              : i
          )
        }));

        get().updateImplantStatus(lockRecord.implantId);
        console.log('[ImplantStore] 取消锁定成功:', lockRecordId);
        return true;
      },

      getActiveLockRecords: () => {
        const { lockRecords } = get();
        return lockRecords.filter((r) => r.status === 'locked');
      },

      getLockRecordsByImplant: (implantId) => {
        const { lockRecords } = get();
        return lockRecords.filter((r) => r.implantId === implantId);
      },

      confirmUsage: (recordData) => {
        const { implants, updateImplantStatus } = get();
        const implant = implants.find((i) => i.id === recordData.implantId);
        if (!implant) {
          console.error('[ImplantStore] 领用失败：种植体不存在');
          return false;
        }

        const available = implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity;
        if (recordData.quantity > available) {
          console.error('[ImplantStore] 领用失败：库存不足');
          return false;
        }

        const newRecord: UsageRecord = {
          ...recordData,
          id: generateId(),
          usedAt: dayjs().format('YYYY-MM-DD HH:mm')
        };

        set((state) => ({
          usageRecords: [...state.usageRecords, newRecord],
          implants: state.implants.map((i) => {
            if (i.id === recordData.implantId) {
              const newUsed = i.usedQuantity + recordData.quantity;
              const totalUsed = newUsed + i.lockedQuantity + i.adjustedQuantity;
              let status: ImplantInfo['status'] = 'in_stock';
              if (totalUsed >= i.quantity) status = 'fully_used';
              else if (newUsed > 0) status = 'partial_used';
              return {
                ...i,
                usedQuantity: newUsed,
                status
              };
            }
            return i;
          })
        }));

        updateImplantStatus(recordData.implantId);
        console.log('[ImplantStore] 确认领用:', newRecord);
        return true;
      },

      getBatchDetail: (batchNo) => {
        const { implants, usageRecords, lockRecords, adjustmentRecords } = get();
        const implant = implants.find((i) => i.batchNo === batchNo);
        if (!implant) return null;

        const records = usageRecords.filter((r) => r.batchNo === batchNo);
        const locks = lockRecords.filter((r) => r.batchNo === batchNo && r.status === 'locked');
        const adjustments = adjustmentRecords.filter((r) => r.batchNo === batchNo);

        return {
          implant,
          usageRecords: records,
          lockRecords: locks,
          adjustmentRecords: adjustments,
          stockInfo: {
            totalQuantity: implant.quantity,
            usedQuantity: implant.usedQuantity,
            lockedQuantity: implant.lockedQuantity,
            adjustedQuantity: implant.adjustedQuantity,
            availableQuantity: implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity
          }
        };
      },

      getBatchDetailById: (implantId) => {
        const { implants, usageRecords, lockRecords, adjustmentRecords } = get();
        const implant = implants.find((i) => i.id === implantId);
        if (!implant) return null;

        const records = usageRecords.filter((r) => r.implantId === implantId);
        const locks = lockRecords.filter((r) => r.implantId === implantId && r.status === 'locked');
        const adjustments = adjustmentRecords.filter((r) => r.implantId === implantId);

        return {
          implant,
          usageRecords: records,
          lockRecords: locks,
          adjustmentRecords: adjustments,
          stockInfo: {
            totalQuantity: implant.quantity,
            usedQuantity: implant.usedQuantity,
            lockedQuantity: implant.lockedQuantity,
            adjustedQuantity: implant.adjustedQuantity,
            availableQuantity: implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity
          }
        };
      },

      getBatchSummary: (batchNo) => {
        const { implants, usageRecords, lockRecords, adjustmentRecords } = get();
        const matchingImplants = implants.filter((i) => i.batchNo === batchNo);
        if (matchingImplants.length === 0) return null;

        const records = usageRecords.filter((r) => r.batchNo === batchNo);
        const locks = lockRecords.filter((r) => r.batchNo === batchNo && r.status === 'locked');
        const adjustments = adjustmentRecords.filter((r) => r.batchNo === batchNo);

        const totalQuantity = matchingImplants.reduce((sum, i) => sum + i.quantity, 0);
        const usedQuantityFromImplants = matchingImplants.reduce((sum, i) => sum + i.usedQuantity, 0);
        const usedQuantityFromRecords = records.reduce((sum, r) => sum + r.quantity, 0);
        const usedQuantity = Math.max(usedQuantityFromImplants, usedQuantityFromRecords);
        const usedCaseCount = records.length;
        const lockedQuantity = locks.reduce((sum, r) => sum + r.quantity, 0);
        const adjustedQuantity = adjustments.reduce((sum, r) => sum + r.quantity, 0);

        const uniqueSpecs = [...new Set(matchingImplants.map((i) => i.spec))];
        const uniqueSuppliers = [...new Set(matchingImplants.map((i) => i.supplier))];

        return {
          batchNo,
          implants: matchingImplants,
          usageRecords: records,
          lockRecords: locks,
          adjustmentRecords: adjustments,
          totalStock: {
            totalQuantity,
            usedQuantity,
            usedCaseCount,
            usedQuantityFromRecords,
            lockedQuantity,
            adjustedQuantity,
            availableQuantity: totalQuantity - usedQuantity - lockedQuantity - adjustedQuantity
          },
          uniqueSpecs,
          uniqueSuppliers
        };
      },

      searchByBatchNo: (batchNo) => {
        if (!batchNo.trim()) return [];
        const { implants } = get();
        return implants.filter((i) =>
          i.batchNo.toLowerCase().includes(batchNo.toLowerCase())
        );
      },

      getAvailableImplants: () => {
        const { implants } = get();
        return implants.filter((i) => {
          const available = i.quantity - i.usedQuantity - i.lockedQuantity - i.adjustedQuantity;
          return available > 0 && i.status !== 'fully_used';
        });
      },

      getExistingBatchNos: () => {
        const { implants, pendingItems } = get();
        const implantBatchNos = implants.map((i) => i.batchNo);
        const pendingBatchNos = pendingItems.map((i) => i.batchNo);
        return [...new Set([...implantBatchNos, ...pendingBatchNos])];
      },

      getBatchNoMatches: (batchNo) => {
        const { implants, pendingItems } = get();
        const allItems = [
          ...implants.map(i => ({ spec: i.spec, inboundDate: i.inboundDate })),
          ...pendingItems.map(i => ({ spec: i.spec, inboundDate: dayjs().format('YYYY-MM-DD') }))
        ].filter(i => i.spec && i.inboundDate && implants.some(imp => imp.batchNo === batchNo && imp.spec === i.spec) || pendingItems.some(pi => pi.batchNo === batchNo && pi.spec === i.spec));

        const matchingImplants = implants.filter(i => i.batchNo === batchNo);
        const matchingPending = pendingItems.filter(i => i.batchNo === batchNo);
        const totalCount = matchingImplants.length + matchingPending.length;
        const specs = [...new Set([...matchingImplants.map(i => i.spec), ...matchingPending.map(i => i.spec)])];
        const inboundDates = [...new Set([...matchingImplants.map(i => i.inboundDate), ...matchingPending.map(() => dayjs().format('YYYY-MM-DD'))])];

        return { count: totalCount, specs, inboundDates };
      },

      getAlerts: () => {
        const { implants } = get();
        const items: AlertItem[] = [];
        const now = dayjs();

        implants.forEach((implant) => {
          const available = implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity;
          if (available <= 0) return;

          const daysDiff = dayjs(implant.expiryDate).diff(now, 'day');
          const alertId = `alert_${implant.id}`;

          if (daysDiff < 0) {
            items.push({
              id: alertId,
              type: 'expiry_expired',
              level: 'error',
              title: '已过期',
              message: `该批号已过期 ${Math.abs(daysDiff)} 天，请立即处理`,
              batchNo: implant.batchNo,
              brand: implant.brand,
              spec: implant.spec,
              implantId: implant.id,
              expiryDate: implant.expiryDate,
              daysLeft: daysDiff,
              availableQuantity: available,
              totalQuantity: implant.quantity
            });
          } else if (daysDiff < 180) {
            items.push({
              id: alertId,
              type: 'expiry_near',
              level: 'warning',
              title: '临期提醒',
              message: `有效期不足 ${daysDiff} 天，请优先使用`,
              batchNo: implant.batchNo,
              brand: implant.brand,
              spec: implant.spec,
              implantId: implant.id,
              expiryDate: implant.expiryDate,
              daysLeft: daysDiff,
              availableQuantity: available,
              totalQuantity: implant.quantity
            });
          }

          if (available <= 2) {
            items.push({
              id: `${alertId}_stock`,
              type: 'stock_low',
              level: 'warning',
              title: '库存偏低',
              message: `可用库存仅 ${available} 支，请及时补充`,
              batchNo: implant.batchNo,
              brand: implant.brand,
              spec: implant.spec,
              implantId: implant.id,
              availableQuantity: available,
              totalQuantity: implant.quantity
            });
          }
        });

        items.sort((a, b) => {
          if (a.level === 'error' && b.level !== 'error') return -1;
          if (a.level !== 'error' && b.level === 'error') return 1;
          if (a.type === 'expiry_expired' && b.type !== 'expiry_expired') return -1;
          if (a.type !== 'expiry_expired' && b.type === 'expiry_expired') return 1;
          if (a.type === 'expiry_near' && b.type === 'stock_low') return -1;
          if (a.type === 'stock_low' && b.type === 'expiry_near') return 1;
          return 0;
        });

        return {
          total: items.length,
          expired: items.filter((i) => i.type === 'expiry_expired').length,
          nearExpiry: items.filter((i) => i.type === 'expiry_near').length,
          lowStock: items.filter((i) => i.type === 'stock_low').length,
          items
        };
      },

      updateImplantStatus: (implantId) => {
        set((state) => ({
          implants: state.implants.map((i) => {
            if (i.id !== implantId) return i;
            const totalUsed = i.usedQuantity + i.lockedQuantity + i.adjustedQuantity;
            let status: ImplantInfo['status'] = 'in_stock';
            if (totalUsed >= i.quantity) status = 'fully_used';
            else if (i.usedQuantity > 0) status = 'partial_used';
            else if (i.lockedQuantity > 0) status = 'locked';
            return { ...i, status };
          })
        }));
      },

      createAdjustment: (recordData) => {
        const { implants, updateImplantStatus } = get();
        const implant = implants.find((i) => i.id === recordData.implantId);
        if (!implant) {
          console.error('[ImplantStore] 调整失败：种植体不存在');
          return null;
        }

        const available = implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity;
        if (recordData.quantity > available) {
          console.error('[ImplantStore] 调整失败：数量超出可用库存，可用', available, '调整', recordData.quantity);
          return null;
        }

        const newRecord: AdjustmentRecord = {
          ...recordData,
          id: generateId(),
          adjustedAt: dayjs().format('YYYY-MM-DD HH:mm')
        };

        set((state) => ({
          adjustmentRecords: [...state.adjustmentRecords, newRecord],
          implants: state.implants.map((i) =>
            i.id === recordData.implantId
              ? { ...i, adjustedQuantity: i.adjustedQuantity + recordData.quantity }
              : i
          )
        }));

        updateImplantStatus(recordData.implantId);
        console.log('[ImplantStore] 库存调整成功:', newRecord);
        return newRecord;
      },

      getAdjustmentRecordsByImplant: (implantId) => {
        const { adjustmentRecords } = get();
        return adjustmentRecords.filter((r) => r.implantId === implantId);
      },

      getInventoryGroups: (startDate, endDate) => {
        const { implants, usageRecords, lockRecords, adjustmentRecords } = get();
        const groups: Map<string, InventoryGroup> = new Map();
        const hasDateRange = startDate && endDate;

        implants.forEach((implant) => {
          const inRange = !hasDateRange || (implant.inboundDate >= startDate && implant.inboundDate <= endDate);
          const key = `${implant.brand}||${implant.spec}||${implant.batchNo}`;

          if (!groups.has(key)) {
            groups.set(key, {
              key,
              brand: implant.brand,
              spec: implant.spec,
              batchNo: implant.batchNo,
              implants: [],
              openingQuantity: 0,
              inboundQuantity: 0,
              usedQuantity: 0,
              lockedQuantity: 0,
              adjustedQuantity: 0,
              availableQuantity: 0,
              closingQuantity: 0,
              difference: 0
            });
          }

          const group = groups.get(key)!;
          group.implants.push(implant);

          if (inRange) {
            group.inboundQuantity += implant.quantity;
          } else {
            group.openingQuantity += implant.quantity;
          }
        });

        groups.forEach((group, key) => {
          const matchingUsages = usageRecords.filter(
            (r) => {
              const matchKey = r.batchNo === group.batchNo && r.brand === group.brand && r.spec === group.spec;
              if (!matchKey) return false;
              if (!hasDateRange) return true;
              const usedDate = r.usedAt.split(' ')[0];
              return usedDate >= startDate && usedDate <= endDate;
            }
          );
          const matchingLocks = lockRecords.filter(
            (r) => {
              const matchKey = r.status === 'locked' && r.batchNo === group.batchNo && r.brand === group.brand && r.spec === group.spec;
              if (!matchKey) return false;
              if (!hasDateRange) return true;
              const lockedDate = r.lockedAt.split(' ')[0];
              return lockedDate >= startDate && lockedDate <= endDate;
            }
          );
          const matchingAdjustments = adjustmentRecords.filter(
            (r) => {
              const matchKey = r.batchNo === group.batchNo && r.brand === group.brand && r.spec === group.spec;
              if (!matchKey) return false;
              if (!hasDateRange) return true;
              const adjustedDate = r.adjustedAt.split(' ')[0];
              return adjustedDate >= startDate && adjustedDate <= endDate;
            }
          );

          group.usedQuantity = matchingUsages.reduce((sum, r) => sum + r.quantity, 0);
          group.lockedQuantity = matchingLocks.reduce((sum, r) => sum + r.quantity, 0);
          group.adjustedQuantity = matchingAdjustments.reduce((sum, r) => sum + r.quantity, 0);
          group.closingQuantity = group.openingQuantity + group.inboundQuantity - group.usedQuantity - group.lockedQuantity - group.adjustedQuantity;

          const actualAvailable = group.implants.reduce((sum, i) =>
            sum + (i.quantity - i.usedQuantity - i.lockedQuantity - i.adjustedQuantity), 0);
          group.availableQuantity = actualAvailable;
          group.difference = actualAvailable - group.closingQuantity;
        });

        return Array.from(groups.values()).sort((a, b) => {
          if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
          if (a.spec !== b.spec) return a.spec.localeCompare(b.spec);
          return a.batchNo.localeCompare(b.batchNo);
        });
      },

      getInventoryDetail: (implantId, startDate, endDate) => {
        const { implants, usageRecords, lockRecords, adjustmentRecords } = get();
        const implant = implants.find((i) => i.id === implantId);
        if (!implant) return null;
        const hasDateRange = startDate && endDate;

        const usages = usageRecords.filter((r) => {
          if (r.implantId !== implantId) return false;
          if (!hasDateRange) return true;
          const usedDate = r.usedAt.split(' ')[0];
          return usedDate >= startDate && usedDate <= endDate;
        });
        const locks = lockRecords.filter((r) => {
          if (r.implantId !== implantId) return false;
          if (!hasDateRange) return true;
          const lockedDate = r.lockedAt.split(' ')[0];
          return lockedDate >= startDate && lockedDate <= endDate;
        });
        const adjustments = adjustmentRecords.filter((r) => {
          if (r.implantId !== implantId) return false;
          if (!hasDateRange) return true;
          const adjustedDate = r.adjustedAt.split(' ')[0];
          return adjustedDate >= startDate && adjustedDate <= endDate;
        });

        return {
          implantId,
          inboundDate: implant.inboundDate,
          expiryDate: implant.expiryDate,
          supplier: implant.supplier,
          totalQuantity: implant.quantity,
          usedQuantity: usages.reduce((sum, r) => sum + r.quantity, 0),
          lockedQuantity: locks.reduce((sum, r) => sum + r.quantity, 0),
          adjustedQuantity: adjustments.reduce((sum, r) => sum + r.quantity, 0),
          availableQuantity: implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity,
          usageRecords: usages,
          lockRecords: locks,
          adjustmentRecords: adjustments
        };
      },

      exportInventory: (groups) => {
        const header = ['品牌', '规格', '批号', '期初', '入库', '使用', '锁定', '调整', '账面结存', '实际可用', '差异'];
        const rows = groups.map((g) => [
          g.brand, g.spec, g.batchNo,
          g.openingQuantity.toString(), g.inboundQuantity.toString(),
          g.usedQuantity.toString(), g.lockedQuantity.toString(),
          g.adjustedQuantity.toString(),
          g.closingQuantity.toString(), g.availableQuantity.toString(),
          g.difference.toString()
        ]);

        const summary = ['合计', '', '',
          groups.reduce((s, g) => s + g.openingQuantity, 0).toString(),
          groups.reduce((s, g) => s + g.inboundQuantity, 0).toString(),
          groups.reduce((s, g) => s + g.usedQuantity, 0).toString(),
          groups.reduce((s, g) => s + g.lockedQuantity, 0).toString(),
          groups.reduce((s, g) => s + g.adjustedQuantity, 0).toString(),
          groups.reduce((s, g) => s + g.closingQuantity, 0).toString(),
          groups.reduce((s, g) => s + g.availableQuantity, 0).toString(),
          groups.reduce((s, g) => s + g.difference, 0).toString()
        ];

        const csv = [header, ...rows, summary].map(r => r.join(',')).join('\n');
        console.log('[ImplantStore] 导出盘点数据:\n', csv);
        return csv;
      },

      getSurgeryStockpiles: (dateRange, doctor) => {
        const { lockRecords, implants } = get();
        const now = dayjs();
        let startDate = now.clone();
        let endDate = now.clone();

        switch (dateRange) {
          case 'today':
            endDate = startDate.clone();
            break;
          case 'tomorrow':
            startDate = startDate.add(1, 'day');
            endDate = startDate.clone();
            break;
          case 'week':
            endDate = startDate.add(6, 'day');
            break;
        }

        const dateSet = new Set<string>();
        let d = startDate.clone();
        while (d.isBefore(endDate) || d.isSame(endDate, 'day')) {
          dateSet.add(d.format('YYYY-MM-DD'));
          d = d.add(1, 'day');
        }

        const activeLocks = lockRecords.filter((r) => {
          if (!dateSet.has(r.surgeryDate)) return false;
          if (doctor && r.doctor !== doctor) return false;
          return r.status === 'locked';
        });

        const stockpileMap = new Map<string, SurgeryStockpile>();

        activeLocks.forEach((lock) => {
          const key = `${lock.surgeryDate}||${lock.doctor}||${lock.patientId}||${lock.brand}||${lock.spec}`;
          if (!stockpileMap.has(key)) {
            stockpileMap.set(key, {
              surgeryDate: lock.surgeryDate,
              doctor: lock.doctor,
              patientInitial: lock.patientInitial,
              patientId: lock.patientId,
              brand: lock.brand,
              spec: lock.spec,
              requiredQuantity: 0,
              availableBatches: [],
              totalAvailable: 0,
              hasShortage: false,
              shortageQuantity: 0,
              status: 'pending'
            });
          }
          const sp = stockpileMap.get(key)!;
          sp.requiredQuantity += lock.quantity;

          if (lock.status === 'locked') {
            sp.lockedImplantId = lock.implantId;
            sp.lockedBatchNo = lock.batchNo;
            sp.lockRecordId = lock.id;
            sp.status = 'locked';
          }
        });

        stockpileMap.forEach((sp) => {
          const matchingImplants = implants.filter(
            (i) => i.brand === sp.brand && i.spec === sp.spec
          );

          sp.availableBatches = matchingImplants.map((i) => ({
            implantId: i.id,
            batchNo: i.batchNo,
            expiryDate: i.expiryDate,
            availableQuantity: i.quantity - i.usedQuantity - i.lockedQuantity - i.adjustedQuantity
          })).filter((b) => b.availableQuantity > 0);

          sp.availableBatches.sort((a, b) => {
            const daysA = dayjs(a.expiryDate).diff(now, 'day');
            const daysB = dayjs(b.expiryDate).diff(now, 'day');
            return daysA - daysB;
          });

          sp.totalAvailable = sp.availableBatches.reduce((sum, b) => sum + b.availableQuantity, 0);

          let lockedQty = 0;
          if (sp.status === 'locked' && sp.lockedImplantId) {
            const batch = sp.availableBatches.find((b) => b.implantId === sp.lockedImplantId);
            lockedQty = batch ? Math.min(sp.requiredQuantity, batch.availableQuantity + (activeLocks.find(l => l.id === sp.lockRecordId)?.quantity || 0)) : sp.requiredQuantity;
          }

          sp.hasShortage = sp.totalAvailable < sp.requiredQuantity;
          sp.shortageQuantity = Math.max(0, sp.requiredQuantity - sp.totalAvailable - lockedQty);

          if (sp.status === 'locked' && sp.requiredQuantity > lockedQty) {
            sp.status = 'partial';
          }
        });

        const result = Array.from(stockpileMap.values()).sort((a, b) => {
          if (a.surgeryDate !== b.surgeryDate) return a.surgeryDate.localeCompare(b.surgeryDate);
          if (a.doctor !== b.doctor) return a.doctor.localeCompare(b.doctor);
          return a.patientId.localeCompare(b.patientId);
        });

        return result;
      },

      batchLockStockpiles: (items) => {
        const results: LockRecord[] = [];
        items.forEach((item) => {
          const lock = get().createLockRecord({
            implantId: item.implantId,
            batchNo: item.batchNo,
            brand: item.brand,
            spec: item.spec,
            doctor: item.doctor,
            patientInitial: item.patientInitial,
            patientId: item.patientId,
            surgeryDate: item.surgeryDate,
            quantity: item.quantity,
            operator: item.operator
          });
          if (lock) results.push(lock);
        });
        return results;
      }
    }),
    {
      name: 'implant-storage'
    }
  )
);
