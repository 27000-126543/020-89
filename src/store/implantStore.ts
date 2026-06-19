import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import dayjs from 'dayjs';
import type { ImplantInfo, UsageRecord, PendingItem, BatchDetail } from '@/types/implant';
import { generateId } from '@/utils/validator';
import { mockImplants, mockUsageRecords } from '@/data/mockData';

interface ImplantState {
  implants: ImplantInfo[];
  usageRecords: UsageRecord[];
  pendingItems: PendingItem[];
  addImplant: (implant: Omit<ImplantInfo, 'id' | 'inboundDate' | 'status' | 'usedQuantity' | 'lockedQuantity'>) => void;
  addPendingItem: (item: Omit<PendingItem, 'id'>) => void;
  removePendingItem: (id: string) => void;
  clearPendingItems: () => void;
  confirmInbound: () => void;
  lockImplant: (implantId: string, quantity: number) => boolean;
  confirmUsage: (record: Omit<UsageRecord, 'id' | 'usedAt'>) => boolean;
  getBatchDetail: (batchNo: string) => BatchDetail | null;
  searchByBatchNo: (batchNo: string) => ImplantInfo[];
  getAvailableImplants: () => ImplantInfo[];
  getExistingBatchNos: () => string[];
}

export const useImplantStore = create<ImplantState>()(
  persist(
    (set, get) => ({
      implants: mockImplants,
      usageRecords: mockUsageRecords,
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
        pendingItems.forEach((item) => {
          addImplant({
            barcode: item.barcode,
            brand: item.brand,
            spec: item.spec,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            supplier: item.supplier,
            quantity: item.quantity
          });
        });
        set({ pendingItems: [] });
        console.log('[ImplantStore] 确认入库完成，共', pendingItems.length, '项');
      },

      lockImplant: (implantId, quantity) => {
        const { implants } = get();
        const implant = implants.find((i) => i.id === implantId);
        if (!implant) {
          console.error('[ImplantStore] 锁定失败：种植体不存在');
          return false;
        }
        const available = implant.quantity - implant.usedQuantity - implant.lockedQuantity;
        if (quantity > available) {
          console.error('[ImplantStore] 锁定失败：库存不足');
          return false;
        }
        set((state) => ({
          implants: state.implants.map((i) =>
            i.id === implantId
              ? { ...i, lockedQuantity: i.lockedQuantity + quantity, status: 'locked' as const }
              : i
          )
        }));
        console.log('[ImplantStore] 锁定种植体成功:', implantId, '数量:', quantity);
        return true;
      },

      confirmUsage: (recordData) => {
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
              const newLocked = Math.max(0, i.lockedQuantity - recordData.quantity);
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
        console.log('[ImplantStore] 确认领用:', newRecord);
        return true;
      },

      getBatchDetail: (batchNo) => {
        const { implants, usageRecords } = get();
        const implant = implants.find((i) => i.batchNo === batchNo);
        if (!implant) return null;

        const records = usageRecords.filter((r) => r.batchNo === batchNo);
        const totalUsed = records.reduce((sum, r) => sum + r.quantity, 0);

        return {
          implant,
          usageRecords: records,
          stockInfo: {
            totalQuantity: implant.quantity,
            usedQuantity: implant.usedQuantity,
            lockedQuantity: implant.lockedQuantity,
            availableQuantity: implant.quantity - implant.usedQuantity - implant.lockedQuantity
          }
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
        const { implants } = get();
        return implants.map((i) => i.batchNo);
      }
    }),
    {
      name: 'implant-storage'
    }
  )
);
