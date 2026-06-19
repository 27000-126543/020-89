import React, { useState, useMemo } from 'react';
import { View, Text, Button, ScrollView, Picker, Checkbox } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { useImplantStore } from '@/store/implantStore';
import { daysUntilExpiry } from '@/utils/validator';
import type { SurgeryStockpile, LockRecord, ImplantInfo } from '@/types/implant';
import { DOCTORS } from '@/types/implant';

type TabType = 'stockpile' | 'confirm';
type DateRange = 'today' | 'tomorrow' | 'week';

interface GroupKey {
  surgeryDate: string;
  doctor: string;
}

interface GroupStats {
  totalCases: number;
  totalDemand: number;
  lockedCount: number;
  shortageCount: number;
}

const DATE_RANGE_OPTIONS: DateRange[] = ['today', 'tomorrow', 'week'];
const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: '今天',
  tomorrow: '明天',
  week: '本周'
};
const DOCTOR_OPTIONS = ['全部医生', ...DOCTORS];

const OutboundPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('stockpile');
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [doctorIndex, setDoctorIndex] = useState<number>(0);
  const [selectedCaseKeys, setSelectedCaseKeys] = useState<Set<string>>(new Set());
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  const {
    implants,
    getSurgeryStockpiles,
    batchLockStockpiles,
    createLockRecord,
    confirmLockUsage,
    cancelLockRecord,
    getActiveLockRecords,
    lockRecords
  } = useImplantStore();

  const selectedDoctor = doctorIndex === 0 ? undefined : DOCTOR_OPTIONS[doctorIndex];

  const stockpiles = useMemo(() => {
    return getSurgeryStockpiles(dateRange, selectedDoctor);
  }, [dateRange, selectedDoctor, getSurgeryStockpiles, lockRecords, implants]);

  const activeLockRecords = useMemo(() => getActiveLockRecords(), [getActiveLockRecords, lockRecords]);

  const { groups, groupKeys } = useMemo(() => {
    const map = new Map<string, SurgeryStockpile[]>();
    const keyOrder: GroupKey[] = [];
    const seen = new Set<string>();

    stockpiles.forEach((sp) => {
      const key = `${sp.surgeryDate}||${sp.doctor}`;
      if (!seen.has(key)) {
        seen.add(key);
        keyOrder.push({ surgeryDate: sp.surgeryDate, doctor: sp.doctor });
        map.set(key, []);
      }
      map.get(key)!.push(sp);
    });

    return { groups: map, groupKeys: keyOrder };
  }, [stockpiles]);

  const getCaseKey = (sp: SurgeryStockpile) =>
    `${sp.surgeryDate}||${sp.doctor}||${sp.patientId}||${sp.brand}||${sp.spec}`;

  const getGroupStats = (items: SurgeryStockpile[]): GroupStats => {
    let totalCases = items.length;
    let totalDemand = 0;
    let lockedCount = 0;
    let shortageCount = 0;

    items.forEach((sp) => {
      totalDemand += sp.requiredQuantity;
      if (sp.status === 'locked') lockedCount++;
      if (sp.hasShortage) shortageCount++;
    });

    return { totalCases, totalDemand, lockedCount, shortageCount };
  };

  const getStockpileStatusType = (sp: SurgeryStockpile): 'locked' | 'partial' | 'shortage' | 'pending' => {
    if (sp.status === 'locked') return 'locked';
    if (sp.status === 'partial') return 'partial';
    if (sp.hasShortage) return 'shortage';
    return 'pending';
  };

  const getStatusLabel = (type: 'locked' | 'partial' | 'shortage' | 'pending') => {
    const map = {
      locked: '已锁定',
      partial: '部分锁定',
      shortage: '库存不足',
      pending: '待备货'
    };
    return map[type];
  };

  const getExpiryClass = (expiryDate: string) => {
    const days = daysUntilExpiry(expiryDate);
    if (days < 0) return styles.expiryError;
    if (days < 180) return styles.expiryWarn;
    return '';
  };

  const findNearestSufficientBatch = (sp: SurgeryStockpile) => {
    const sorted = [...sp.availableBatches].sort((a, b) =>
      dayjs(a.expiryDate).diff(dayjs(b.expiryDate), 'day')
    );
    let remaining = sp.requiredQuantity;
    if (sp.status === 'locked' && sp.lockedImplantId) {
      const lockRec = lockRecords.find(l => l.id === sp.lockRecordId && l.status === 'locked');
      if (lockRec) {
        remaining = Math.max(0, sp.requiredQuantity - lockRec.quantity);
      }
    }
    if (remaining <= 0) return null;
    return sorted.find(b => b.availableQuantity >= remaining) || null;
  };

  const toggleCaseSelection = (caseKey: string, sp: SurgeryStockpile) => {
    const next = new Set(selectedCaseKeys);
    if (next.has(caseKey)) {
      next.delete(caseKey);
    } else {
      if (getStockpileStatusType(sp) === 'locked') {
        Taro.showToast({ title: '该病例已锁定', icon: 'none' });
        return;
      }
      if (getStockpileStatusType(sp) === 'shortage') {
        Taro.showToast({ title: '库存不足无法锁定', icon: 'none' });
        return;
      }
      next.add(caseKey);
    }
    setSelectedCaseKeys(next);
  };

  const toggleCaseExpand = (caseKey: string) => {
    const next = new Set(expandedCases);
    if (next.has(caseKey)) {
      next.delete(caseKey);
    } else {
      next.add(caseKey);
    }
    setExpandedCases(next);
  };

  const selectableCases = useMemo(() => {
    return stockpiles.filter((sp) => {
      const t = getStockpileStatusType(sp);
      return t !== 'locked' && t !== 'shortage';
    });
  }, [stockpiles]);

  const allSelectableSelected = selectableCases.length > 0 &&
    selectableCases.every((sp) => selectedCaseKeys.has(getCaseKey(sp)));

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedCaseKeys(new Set());
    } else {
      const next = new Set<string>();
      selectableCases.forEach((sp) => next.add(getCaseKey(sp)));
      setSelectedCaseKeys(next);
    }
  };

  const handleQuickLock = (sp: SurgeryStockpile) => {
    if (sp.status === 'locked') {
      Taro.showToast({ title: '该病例已锁定', icon: 'none' });
      return;
    }

    const batch = findNearestSufficientBatch(sp);
    if (!batch) {
      Taro.showToast({ title: '没有足够库存的批次', icon: 'none' });
      return;
    }

    const existingLockQty = sp.status === 'partial' && sp.lockRecordId
      ? (lockRecords.find(l => l.id === sp.lockRecordId && l.status === 'locked')?.quantity || 0)
      : 0;
    const needQty = Math.max(0, sp.requiredQuantity - existingLockQty);

    Taro.showModal({
      title: '确认快速锁定',
      content: `锁定 ${batch.batchNo} (效期 ${batch.expiryDate}) 共 ${needQty} 支？`,
      success: (res) => {
        if (!res.confirm) return;

        const result = createLockRecord({
          implantId: batch.implantId,
          batchNo: batch.batchNo,
          brand: sp.brand,
          spec: sp.spec,
          doctor: sp.doctor,
          patientInitial: sp.patientInitial,
          patientId: sp.patientId,
          surgeryDate: sp.surgeryDate,
          quantity: needQty,
          operator: '当前护士'
        });

        if (result) {
          Taro.vibrateShort({ type: 'medium' });
          Taro.showToast({ title: '锁定成功', icon: 'success' });
        } else {
          Taro.showToast({ title: '锁定失败', icon: 'none' });
        }
      }
    });
  };

  const handleCancelLock = (sp: SurgeryStockpile) => {
    if (!sp.lockRecordId) return;
    const lock = lockRecords.find(l => l.id === sp.lockRecordId);
    if (!lock) return;

    Taro.showModal({
      title: '取消锁定',
      content: `确定取消 ${lock.brand} ${lock.spec} × ${lock.quantity} 的锁定吗？`,
      success: (res) => {
        if (!res.confirm) return;
        const ok = cancelLockRecord(sp.lockRecordId!);
        Taro.showToast({ title: ok ? '已取消' : '操作失败', icon: ok ? 'success' : 'none' });
      }
    });
  };

  const handleBatchLock = () => {
    const items: {
      surgeryDate: string;
      doctor: string;
      patientInitial: string;
      patientId: string;
      implantId: string;
      quantity: number;
      operator: string;
      brand: string;
      spec: string;
      batchNo: string;
    }[] = [];
    let skipped = 0;

    stockpiles.forEach((sp) => {
      if (!selectedCaseKeys.has(getCaseKey(sp))) return;
      const batch = findNearestSufficientBatch(sp);
      if (!batch) {
        skipped++;
        return;
      }
      const existingLockQty = sp.status === 'partial' && sp.lockRecordId
        ? (lockRecords.find(l => l.id === sp.lockRecordId && l.status === 'locked')?.quantity || 0)
        : 0;
      const needQty = Math.max(0, sp.requiredQuantity - existingLockQty);
      if (needQty <= 0) {
        skipped++;
        return;
      }
      items.push({
        surgeryDate: sp.surgeryDate,
        doctor: sp.doctor,
        patientInitial: sp.patientInitial,
        patientId: sp.patientId,
        implantId: batch.implantId,
        quantity: needQty,
        operator: '当前护士',
        brand: sp.brand,
        spec: sp.spec,
        batchNo: batch.batchNo
      });
    });

    if (items.length === 0) {
      Taro.showToast({ title: '没有可锁定的项', icon: 'none' });
      return;
    }

    Taro.showModal({
      title: '批量锁定',
      content: `共 ${items.length} 项${skipped > 0 ? ` (跳过${skipped}项)` : ''}，确认锁定？`,
      success: (res) => {
        if (!res.confirm) return;
        const results = batchLockStockpiles(items);
        setSelectedCaseKeys(new Set());
        Taro.vibrateShort({ type: 'medium' });
        Taro.showToast({
          title: `成功 ${results.length}/${items.length}`,
          icon: results.length === items.length ? 'success' : 'none'
        });
      }
    });
  };

  const handleConfirmUsage = (lockRecord: LockRecord) => {
    Taro.showModal({
      title: '确认使用',
      content: `确认将 ${lockRecord.brand} ${lockRecord.spec} × ${lockRecord.quantity} 转为已使用吗？此操作不可撤销。`,
      success: (res) => {
        if (!res.confirm) return;
        const ok = confirmLockUsage(lockRecord.id);
        Taro.showToast({ title: ok ? '已确认使用' : '操作失败', icon: ok ? 'success' : 'none' });
      }
    });
  };

  const handleCancelLockFromConfirm = (lockRecord: LockRecord) => {
    Taro.showModal({
      title: '取消锁定',
      content: `确定取消 ${lockRecord.brand} ${lockRecord.spec} × ${lockRecord.quantity} 的锁定吗？库存将被释放。`,
      success: (res) => {
        if (!res.confirm) return;
        const ok = cancelLockRecord(lockRecord.id);
        Taro.showToast({ title: ok ? '已取消锁定' : '操作失败', icon: ok ? 'success' : 'none' });
      }
    });
  };

  const getStockClass = (available: number, total: number) => {
    const ratio = total > 0 ? available / total : 0;
    if (ratio <= 0.2) return styles.stockLow;
    return styles.stockNormal;
  };

  const handleRefresh = () => {
    Taro.stopPullDownRefresh();
  };

  React.useEffect(() => {
    const unlisten = Taro.onPullDownRefresh(handleRefresh);
    return () => unlisten?.();
  }, []);

  const formatDate = (d: string) => {
    const date = dayjs(d);
    const today = dayjs().format('YYYY-MM-DD');
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    if (d === today) return `今天 (${date.format('MM-DD')})`;
    if (d === tomorrow) return `明天 (${date.format('MM-DD')})`;
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${weekdays[date.day()]} (${date.format('MM-DD')})`;
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>椅旁领用</Text>
        <Text className={styles.headerSubtitle}>术前备货锁定，术后确认使用</Text>
      </View>

      <View className={styles.tabs}>
        <View
          className={classnames(styles.tab, activeTab === 'stockpile' && styles.activeTab)}
          onClick={() => setActiveTab('stockpile')}
        >
          <Text className={styles.tabText}>术前备货</Text>
          {stockpiles.length > 0 && (
            <View className={styles.tabBadge}>{stockpiles.length}</View>
          )}
        </View>
        <View
          className={classnames(styles.tab, activeTab === 'confirm' && styles.activeTab)}
          onClick={() => setActiveTab('confirm')}
        >
          <Text className={styles.tabText}>术后确认</Text>
          {activeLockRecords.length > 0 && (
            <View className={styles.tabBadge}>{activeLockRecords.length}</View>
          )}
        </View>
        <View className={styles.tabIndicator} style={{ left: activeTab === 'stockpile' ? '0%' : '50%' }} />
      </View>

      {activeTab === 'stockpile' && (
        <>
          <View className={styles.filterSection}>
            <View className={styles.dateTabs}>
              {DATE_RANGE_OPTIONS.map((range) => (
                <View
                  key={range}
                  className={classnames(styles.dateTab, dateRange === range && styles.activeDateTab)}
                  onClick={() => {
                    setDateRange(range);
                    setSelectedCaseKeys(new Set());
                  }}
                >
                  {DATE_RANGE_LABELS[range]}
                </View>
              ))}
            </View>

            <View className={styles.doctorPickerWrap}>
              <Text className={styles.doctorLabel}>筛选医生</Text>
              <Picker
                mode='selector'
                range={DOCTOR_OPTIONS}
                value={doctorIndex}
                onChange={(e) => {
                  setDoctorIndex(Number(e.detail.value));
                  setSelectedCaseKeys(new Set());
                }}
              >
                <View className={styles.doctorPicker}>
                  {DOCTOR_OPTIONS[doctorIndex]}
                  <Text className={styles.pickerArrow}>▾</Text>
                </View>
              </Picker>
            </View>
          </View>

          {stockpiles.length > 0 && (
            <View className={styles.batchActionBar}>
              <View className={styles.batchLeft}>
                <View className={styles.checkboxWrap}>
                  <View
                    className={classnames(styles.checkbox, allSelectableSelected && styles.checked)}
                    onClick={toggleSelectAll}
                  >
                    {allSelectableSelected && <Text className={styles.checkmark}>✓</Text>}
                  </View>
                </View>
                <Text className={styles.selectedCount}>
                  已选 <Text className={styles.count}>{selectedCaseKeys.size}</Text> 项
                </Text>
              </View>
              <Button
                className={classnames(styles.batchLockBtn, selectedCaseKeys.size === 0 && styles.disabled)}
                onClick={handleBatchLock}
                disabled={selectedCaseKeys.size === 0}
              >
                一键锁定选中项
              </Button>
            </View>
          )}

          {stockpiles.length === 0 ? (
            <View className={styles.emptyState} style={{ margin: '0 32rpx' }}>
              暂无备货清单
            </View>
          ) : (
            <View className={styles.stockpileList}>
              {groupKeys.map(({ surgeryDate, doctor }) => {
                const items = groups.get(`${surgeryDate}||${doctor}`)!;
                const stats = getGroupStats(items);
                return (
                  <View key={`${surgeryDate}||${doctor}`} className={styles.stockpileGroup}>
                    <View className={styles.groupHeader}>
                      <View className={styles.groupTitle}>
                        <Text className={styles.groupDate}>{formatDate(surgeryDate)}</Text>
                        <Text className={styles.groupDoctor}>{doctor}</Text>
                      </View>
                      <View className={styles.groupStats}>
                        <View className={styles.statItem}>
                          <Text className={classnames(styles.statValue, styles.total)}>{stats.totalCases}</Text>
                          <Text className={styles.statLabel}>总病例</Text>
                        </View>
                        <View className={styles.statItem}>
                          <Text className={classnames(styles.statValue, styles.demand)}>{stats.totalDemand}</Text>
                          <Text className={styles.statLabel}>总需求</Text>
                        </View>
                        <View className={styles.statItem}>
                          <Text className={classnames(styles.statValue, styles.locked)}>{stats.lockedCount}</Text>
                          <Text className={styles.statLabel}>已锁定</Text>
                        </View>
                        <View className={styles.statItem}>
                          <Text className={classnames(styles.statValue, styles.shortage)}>{stats.shortageCount}</Text>
                          <Text className={styles.statLabel}>缺位数</Text>
                        </View>
                      </View>
                    </View>

                    <View className={styles.caseList}>
                      {items.map((sp) => {
                        const caseKey = getCaseKey(sp);
                        const statusType = getStockpileStatusType(sp);
                        const isExpanded = expandedCases.has(caseKey);
                        const isSelected = selectedCaseKeys.has(caseKey);
                        const canSelect = statusType !== 'locked' && statusType !== 'shortage';
                        const nearestBatch = sp.availableBatches[0];
                        const existingLockQty = (sp.status === 'locked' || sp.status === 'partial') && sp.lockRecordId
                          ? (lockRecords.find(l => l.id === sp.lockRecordId && l.status === 'locked')?.quantity || 0)
                          : 0;
                        const canQuickLock = (sp.status !== 'locked') &&
                          findNearestSufficientBatch(sp) !== null;

                        return (
                          <View
                            key={caseKey}
                            className={classnames(styles.caseCard, isExpanded && styles.expanded)}
                          >
                            <View
                              className={styles.caseHeader}
                              onClick={() => toggleCaseExpand(caseKey)}
                            >
                              <View
                                className={styles.caseCheckbox}
                                onClick={(e) => {
                                  e.stopPropagation?.();
                                  if (canSelect) toggleCaseSelection(caseKey, sp);
                                }}
                              >
                                <View
                                  className={classnames(
                                    styles.checkbox,
                                    !canSelect && { opacity: 0.4 },
                                    isSelected && styles.checked
                                  )}
                                >
                                  {isSelected && <Text className={styles.checkmark}>✓</Text>}
                                </View>
                              </View>

                              <View className={styles.patientAvatar}>
                                {sp.patientInitial}
                              </View>

                              <View className={styles.caseInfo}>
                                <View className={styles.caseRow1}>
                                  <Text className={styles.caseProduct}>
                                    {sp.brand} {sp.spec}
                                  </Text>
                                  <View className={classnames(styles.statusTag, styles[statusType])}>
                                    {getStatusLabel(statusType)}
                                  </View>
                                </View>

                                <View className={styles.caseMeta}>
                                  <View className={styles.metaItem}>
                                    <Text className={styles.metaLabel}>病历号</Text>
                                    <Text className={styles.metaValue}>{sp.patientId || '-'}</Text>
                                  </View>
                                  <View className={styles.metaItem}>
                                    <Text className={styles.metaLabel}>医生</Text>
                                    <Text className={styles.metaValue}>{sp.doctor}</Text>
                                  </View>
                                  <View className={styles.metaItem}>
                                    <Text className={styles.metaLabel}>手术日期</Text>
                                    <Text className={styles.metaValue}>{sp.surgeryDate}</Text>
                                  </View>
                                </View>

                                <View className={styles.quantityBadge}>
                                  需求 {sp.requiredQuantity} 支
                                  {existingLockQty > 0 && ` · 已锁定 ${existingLockQty}`}
                                  {sp.shortageQuantity > 0 && ` · 缺 ${sp.shortageQuantity}`}
                                </View>
                              </View>

                              <View className={classnames(styles.expandIcon, isExpanded && styles.rotated)}>
                                ›
                              </View>
                            </View>

                            {isExpanded && (
                              <View className={styles.caseBody}>
                                <Text className={styles.batchSectionTitle}>可用批次（按效期排序）</Text>

                                <View className={styles.batchList}>
                                  {sp.availableBatches.length === 0 && (
                                    <View style={{ padding: '24rpx', textAlign: 'center', color: '#999' }}>
                                      暂无可用批次
                                    </View>
                                  )}
                                  {sp.availableBatches.map((batch, idx) => {
                                    const isNearest = idx === 0;
                                    const remainingNeed = sp.requiredQuantity - existingLockQty;
                                    const insufficient = batch.availableQuantity < remainingNeed;
                                    const qtyClass =
                                      batch.availableQuantity === 0 ? styles.zero :
                                        batch.availableQuantity < 3 ? styles.low : '';

                                    return (
                                      <View
                                        key={batch.batchNo}
                                        className={classnames(
                                          styles.batchItem,
                                          insufficient && styles.insufficient,
                                          !insufficient && isNearest && styles.nearest
                                        )}
                                      >
                                        <View className={styles.batchInfo}>
                                          <View className={styles.batchNoRow}>
                                            <Text className={styles.batchNo}>{batch.batchNo}</Text>
                                            {!insufficient && isNearest && (
                                              <Text className={styles.nearestTag}>最近效期</Text>
                                            )}
                                          </View>
                                          <Text className={classnames(styles.batchExpiry, getExpiryClass(batch.expiryDate))}>
                                            效期 {batch.expiryDate}
                                          </Text>
                                        </View>
                                        <View className={styles.batchAvailable}>
                                          <Text className={classnames(styles.qty, qtyClass)}>
                                            {batch.availableQuantity}
                                          </Text>
                                          <Text className={styles.qtyLabel}>可用</Text>
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>

                                <View className={styles.actionRow}>
                                  {sp.status === 'locked' && sp.lockRecordId ? (
                                    <Button
                                      className={styles.cancelLockBtn}
                                      onClick={() => handleCancelLock(sp)}
                                    >
                                      取消锁定
                                    </Button>
                                  ) : (
                                    <Button
                                      className={classnames(styles.quickLockBtn, !canQuickLock && styles.disabled)}
                                      onClick={() => handleQuickLock(sp)}
                                      disabled={!canQuickLock}
                                    >
                                      快速锁定（选最近效期）
                                    </Button>
                                  )}
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {activeTab === 'confirm' && (
        <View className={styles.confirmSection}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>待确认使用</Text>
            <Text className={styles.recordCount}>共 {activeLockRecords.length} 条</Text>
          </View>

          {activeLockRecords.length === 0 ? (
            <View className={styles.emptyState}>暂无待确认的锁定记录</View>
          ) : (
            <View className={styles.lockList}>
              {activeLockRecords.map((record) => {
                const implant = implants.find((i) => i.id === record.implantId);
                const available = implant
                  ? implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity
                  : 0;
                return (
                  <View key={record.id} className={styles.lockItem}>
                    <View className={styles.lockHeader}>
                      <View>
                        <Text className={styles.lockProduct}>
                          {record.brand} {record.spec} × {record.quantity}
                        </Text>
                        <Text className={styles.lockBatch}>{record.batchNo}</Text>
                      </View>
                      <View className={styles.lockStatus}>锁定中</View>
                    </View>

                    <View className={styles.lockInfo}>
                      <View className={styles.recordTag}>
                        <Text className={styles.label}>医生:</Text>
                        <Text className={styles.value}>{record.doctor}</Text>
                      </View>
                      <View className={styles.recordTag}>
                        <Text className={styles.label}>患者:</Text>
                        <Text className={styles.value}>
                          {record.patientInitial}XX
                          {record.patientId && ` (${record.patientId})`}
                        </Text>
                      </View>
                      <View className={styles.recordTag}>
                        <Text className={styles.label}>手术:</Text>
                        <Text className={styles.value}>{record.surgeryDate}</Text>
                      </View>
                    </View>

                    <Text className={styles.recordTime}>锁定时间: {record.lockedAt}</Text>

                    {implant && (
                      <View className={styles.lockStock}>
                        <View className={classnames(styles.tag, getExpiryClass(implant.expiryDate))}>
                          有效期
                          <Text className={styles.highlight}>{implant.expiryDate}</Text>
                        </View>
                        <View className={classnames(styles.tag, getStockClass(available, implant.quantity))}>
                          可用
                          <Text className={styles.highlight}>{available}</Text>
                        </View>
                      </View>
                    )}

                    <View className={styles.lockActions}>
                      <Button
                        className={classnames(styles.actionBtn, styles.cancelBtn)}
                        onClick={() => handleCancelLockFromConfirm(record)}
                      >
                        取消锁定
                      </Button>
                      <Button
                        className={classnames(styles.actionBtn, styles.confirmBtn)}
                        onClick={() => handleConfirmUsage(record)}
                      >
                        确认使用
                      </Button>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

export default OutboundPage;
