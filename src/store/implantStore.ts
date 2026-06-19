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
  AlertType
} from '@/types/implant';
import { generateId } from '@/utils/validator';
import { mockImplants, mockUsageRecords, mockLockRecords } from '@/data/mockData';

interface ImplantState {
  implants: ImplantInfo[];
  usageRecords: UsageRecord[];
  lockRecords: LockRecord[];
  pendingItems: PendingItem[];

  addImplant: (implant: Omit<ImplantInfo, 'id' | 'inboundDate' | 'status' | 'usedQuantity' | 'lockedQuantity'>) => ImplantInfo;
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

  getAlerts: () => AlertSummary;
  updateImplantStatus: (implantId: string) => void;
}

export const useImplantStore = create<ImplantState>()(
  persist(
    (set, get) => ({
      implants: mockImplants,
      usageRecords: mockUsageRecords,
      lockRecords: mockLockRecords,
      pendingItems: [],

      addImplant: (implantData) => {
        const newImplant: ImplantInfo = {
          ...implantData,
          id: generateId(),
          inboundDate: dayjs().format('YYYY-MM-DD'),
          status: 'in_stock',
          usedQuantity: 0,
          lockedQuantity: 0
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

        const available = implant.quantity - implant.usedQuantity - implant.lockedQuantity;
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
              const totalUsed = newUsed + newLocked;
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

        const available = implant.quantity - implant.usedQuantity - implant.lockedQuantity;
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
              const totalUsed = newUsed + i.lockedQuantity;
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
        const { implants, usageRecords, lockRecords } = get();
        const implant = implants.find((i) => i.batchNo === batchNo);
        if (!implant) return null;

        const records = usageRecords.filter((r) => r.batchNo === batchNo);
        const locks = lockRecords.filter((r) => r.batchNo === batchNo && r.status === 'locked');

        return {
          implant,
          usageRecords: records,
          lockRecords: locks,
          stockInfo: {
            totalQuantity: implant.quantity,
            usedQuantity: implant.usedQuantity,
            lockedQuantity: implant.lockedQuantity,
            availableQuantity: implant.quantity - implant.usedQuantity - implant.lockedQuantity
          }
        };
      },

      getBatchDetailById: (implantId) => {
        const { implants, usageRecords, lockRecords } = get();
        const implant = implants.find((i) => i.id === implantId);
        if (!implant) return null;

        const records = usageRecords.filter((r) => r.implantId === implantId);
        const locks = lockRecords.filter((r) => r.implantId === implantId && r.status === 'locked');

        return {
          implant,
          usageRecords: records,
          lockRecords: locks,
          stockInfo: {
            totalQuantity: implant.quantity,
            usedQuantity: implant.usedQuantity,
            lockedQuantity: implant.lockedQuantity,
            availableQuantity: implant.quantity - implant.usedQuantity - implant.lockedQuantity
          }
        };
      },

      getBatchSummary: (batchNo) => {
        const { implants, usageRecords, lockRecords } = get();
        const matchingImplants = implants.filter((i) => i.batchNo === batchNo);
        if (matchingImplants.length === 0) return null;

        const records = usageRecords.filter((r) => r.batchNo === batchNo);
        const locks = lockRecords.filter((r) => r.batchNo === batchNo && r.status === 'locked');

        const totalQuantity = matchingImplants.reduce((sum, i) => sum + i.quantity, 0);
        const usedQuantity = matchingImplants.reduce((sum, i) => sum + i.usedQuantity, 0);
        const lockedQuantity = matchingImplants.reduce((sum, i) => sum + i.lockedQuantity, 0);

        const uniqueSpecs = [...new Set(matchingImplants.map((i) => i.spec))];
        const uniqueSuppliers = [...new Set(matchingImplants.map((i) => i.supplier))];

        return {
          batchNo,
          implants: matchingImplants,
          usageRecords: records,
          lockRecords: locks,
          totalStock: {
            totalQuantity,
            usedQuantity,
            lockedQuantity,
            availableQuantity: totalQuantity - usedQuantity - lockedQuantity
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
          const available = i.quantity - i.usedQuantity - i.lockedQuantity;
          return available > 0 && i.status !== 'fully_used';
        });
      },

      getExistingBatchNos: () => {
        const { implants, pendingItems } = get();
        const implantBatchNos = implants.map((i) => i.batchNo);
        const pendingBatchNos = pendingItems.map((i) => i.batchNo);
        return [...new Set([...implantBatchNos, ...pendingBatchNos])];
      },

      getAlerts: () => {
        const { implants } = get();
        const items: AlertItem[] = [];
        const now = dayjs();

        implants.forEach((implant) => {
          const available = implant.quantity - implant.usedQuantity - implant.lockedQuantity;
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

          const availableRatio = available / implant.quantity;
          if (availableRatio <= 0.2 && available > 0) {
            items.push({
              id: `${alertId}_stock`,
              type: 'stock_low',
              level: 'warning',
              title: '库存偏低',
              message: `可用库存仅 ${available} 支，占总量 ${(availableRatio * 100).toFixed(0)}%`,
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
            const totalUsed = i.usedQuantity + i.lockedQuantity;
            let status: ImplantInfo['status'] = 'in_stock';
            if (totalUsed >= i.quantity) status = 'fully_used';
            else if (i.usedQuantity > 0) status = 'partial_used';
            else if (i.lockedQuantity > 0) status = 'locked';
            return { ...i, status };
          })
        }));
      }
    }),
    {
      name: 'implant-storage'
    }
  )
);
