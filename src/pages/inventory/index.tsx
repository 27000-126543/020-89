import React, { useState, useMemo } from 'react';
import { View, Text, Button, ScrollView, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { useImplantStore } from '@/store/implantStore';
import type { InventoryGroup, InventoryDetail, ImplantInfo } from '@/types/implant';

interface DetailMap {
  [implantId: string]: InventoryDetail | null;
}

const InventoryPage: React.FC = () => {
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<DetailMap>({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const { getInventoryGroups, exportInventory, getInventoryDetail } = useImplantStore();

  const groups = useMemo(() => getInventoryGroups(startDate, endDate), [getInventoryGroups, startDate, endDate]);

  const summary = useMemo(() => {
    return groups.reduce(
      (acc, g) => ({
        opening: acc.opening + g.openingQuantity,
        inbound: acc.inbound + g.inboundQuantity,
        used: acc.used + g.usedQuantity,
        locked: acc.locked + g.lockedQuantity,
        adjusted: acc.adjusted + g.adjustedQuantity,
        closing: acc.closing + g.closingQuantity,
        available: acc.available + g.availableQuantity,
        difference: acc.difference + g.difference,
      }),
      { opening: 0, inbound: 0, used: 0, locked: 0, adjusted: 0, closing: 0, available: 0, difference: 0 }
    );
  }, [groups]);

  const startDateOptions = useMemo(() => ({
    value: startDate,
    start: '2020-01-01',
    end: endDate,
  }), [startDate, endDate]);

  const endDateOptions = useMemo(() => ({
    value: endDate,
    start: startDate,
    end: dayjs().format('YYYY-MM-DD'),
  }), [startDate, endDate]);

  const handleRowClick = async (group: InventoryGroup) => {
    if (expandedKey === group.key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(group.key);

    const missingIds = group.implants
      .map((i) => i.id)
      .filter((id) => detailMap[id] === undefined);

    if (missingIds.length > 0) {
      setLoadingDetail(group.key);
      const newDetailMap: DetailMap = { ...detailMap };
      missingIds.forEach((id) => {
        newDetailMap[id] = getInventoryDetail(id);
      });
      setDetailMap(newDetailMap);
      setLoadingDetail(null);
    }
  };

  const handleJumpToQuery = (implant: ImplantInfo) => {
    Taro.navigateTo({
      url: `/pages/query/index?batchNo=${encodeURIComponent(implant.batchNo)}&implantId=${encodeURIComponent(implant.id)}`,
    });
  };

  const handleJumpToQueryByBatch = (batchNo: string) => {
    Taro.navigateTo({
      url: `/pages/query/index?batchNo=${encodeURIComponent(batchNo)}`,
    });
  };

  const handleExport = () => {
    const content = exportInventory(groups);
    setExportContent(content);
    setShowExportModal(true);
  };

  const handleCopy = async () => {
    try {
      await Taro.setClipboardData({ data: exportContent });
      Taro.showToast({ title: '已复制到剪贴板', icon: 'success' });
    } catch {
      Taro.showToast({ title: '复制失败', icon: 'none' });
    }
  };

  const handleDownload = () => {
    const fs = Taro.getFileSystemManager();
    const filePath = `${Taro.env.USER_DATA_PATH}/inventory_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    try {
      fs.writeFileSync(filePath, '\uFEFF' + exportContent, 'utf8');
      Taro.showModal({
        title: '导出成功',
        content: `文件已保存至：${filePath}`,
        showCancel: false,
      });
    } catch {
      Taro.showToast({ title: '文件保存失败', icon: 'none' });
    }
  };

  const closeExportModal = () => {
    setShowExportModal(false);
  };

  const getAdjustmentTypeText = (type: string) => {
    const map: Record<string, string> = {
      inventory_loss: '盘亏',
      damage: '损坏',
      return: '退回',
      other: '其他',
    };
    return map[type] || type;
  };

  const renderSummaryCards = () => (
    <View className={styles.summaryWrap}>
      <View className={styles.summaryCard}>
        <Text className={classnames(styles.summaryValue, styles.colorOpening)}>{summary.opening}</Text>
        <Text className={styles.summaryLabel}>总期初数</Text>
      </View>
      <View className={styles.summaryCard}>
        <Text className={classnames(styles.summaryValue, styles.colorInbound)}>{summary.inbound}</Text>
        <Text className={styles.summaryLabel}>总入库数</Text>
      </View>
      <View className={styles.summaryCard}>
        <Text className={classnames(styles.summaryValue, styles.colorUsed)}>{summary.used}</Text>
        <Text className={styles.summaryLabel}>总使用数</Text>
      </View>
      <View className={styles.summaryCard}>
        <Text className={classnames(styles.summaryValue, styles.colorLocked)}>{summary.locked}</Text>
        <Text className={styles.summaryLabel}>总锁定数</Text>
      </View>
      <View className={styles.summaryCard}>
        <Text className={classnames(styles.summaryValue, styles.colorAdjusted)}>{summary.adjusted}</Text>
        <Text className={styles.summaryLabel}>总调整数</Text>
      </View>
      <View className={styles.summaryCard}>
        <Text className={classnames(styles.summaryValue, styles.colorClosing)}>{summary.closing}</Text>
        <Text className={styles.summaryLabel}>总账面结存</Text>
      </View>
      <View className={styles.summaryCard}>
        <Text className={classnames(styles.summaryValue, styles.colorAvailable)}>{summary.available}</Text>
        <Text className={styles.summaryLabel}>总实际可用</Text>
      </View>
      <View className={styles.summaryCard}>
        <Text className={classnames(styles.summaryValue, summary.difference !== 0 && styles.colorDifference)}>
          {summary.difference > 0 ? `+${summary.difference}` : summary.difference}
        </Text>
        <Text className={styles.summaryLabel}>总差异</Text>
      </View>
    </View>
  );

  const renderInboundCard = (implant: ImplantInfo) => {
    const detail = detailMap[implant.id];
    const available = detail?.availableQuantity ?? implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity;
    return (
      <View
        key={implant.id}
        className={styles.inboundCard}
        onClick={() => handleJumpToQuery(implant)}
      >
        <View className={styles.inboundHeader}>
          <View className={styles.inboundMain}>
            <Text className={styles.inboundDate}>入库: {detail?.inboundDate ?? implant.inboundDate}</Text>
            <Text className={styles.inboundSupplier}>供应商: {detail?.supplier ?? implant.supplier}</Text>
          </View>
          <Text className={styles.inboundArrow}>›</Text>
        </View>
        <View className={styles.inboundStats}>
          <View className={styles.inboundStat}>
            <Text className={styles.inboundStatValue}>{implant.quantity}</Text>
            <Text className={styles.inboundStatLabel}>入库数量</Text>
          </View>
          <View className={styles.inboundStat}>
            <Text className={classnames(styles.inboundStatValue, styles.colorAvailable)}>{available}</Text>
            <Text className={styles.inboundStatLabel}>剩余可用</Text>
          </View>
          <View className={styles.inboundStat}>
            <Text className={styles.inboundStatValue}>{detail?.expiryDate ?? implant.expiryDate}</Text>
            <Text className={styles.inboundStatLabel}>有效期</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderUsageRecords = (records: InventoryDetail['usageRecords']) => {
    if (records.length === 0) {
      return <View className={styles.emptyTip}>暂无使用记录</View>;
    }
    return (
      <View className={styles.recordList}>
        {records
          .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
          .map((record) => (
            <View key={record.id} className={styles.recordItem}>
              <View className={styles.recordHeader}>
                <Text className={styles.recordDoctor}>{record.doctor}</Text>
                <Text className={styles.recordQuantity}>× {record.quantity}</Text>
              </View>
              <View className={styles.recordInfo}>
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
              <Text className={styles.recordTime}>使用时间: {record.usedAt}</Text>
            </View>
          ))}
      </View>
    );
  };

  const renderLockRecords = (records: InventoryDetail['lockRecords']) => {
    const active = records.filter((r) => r.status === 'locked');
    if (active.length === 0) {
      return <View className={styles.emptyTip}>暂无锁定记录</View>;
    }
    return (
      <View className={styles.recordList}>
        {active
          .sort((a, b) => new Date(b.lockedAt).getTime() - new Date(a.lockedAt).getTime())
          .map((record) => (
            <View key={record.id} className={styles.recordItem}>
              <View className={styles.recordHeader}>
                <Text className={styles.recordDoctor}>{record.doctor}</Text>
                <Text className={classnames(styles.recordQuantity, styles.colorLocked)}>× {record.quantity}</Text>
              </View>
              <View className={styles.recordInfo}>
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
              <Text className={styles.recordTime}>锁定时间: {record.lockedAt} · 操作人: {record.operator}</Text>
            </View>
          ))}
      </View>
    );
  };

  const renderAdjustmentRecords = (records: InventoryDetail['adjustmentRecords']) => {
    if (records.length === 0) {
      return <View className={styles.emptyTip}>暂无调整记录</View>;
    }
    return (
      <View className={styles.recordList}>
        {records
          .sort((a, b) => new Date(b.adjustedAt).getTime() - new Date(a.adjustedAt).getTime())
          .map((record) => (
            <View key={record.id} className={styles.recordItem}>
              <View className={styles.recordHeader}>
                <Text className={styles.recordDoctor}>{getAdjustmentTypeText(record.type)}</Text>
                <Text className={classnames(styles.recordQuantity, styles.colorAdjusted)}>-{record.quantity}</Text>
              </View>
              <View className={styles.recordInfo}>
                <View className={styles.recordTag}>
                  <Text className={styles.label}>原因:</Text>
                  <Text className={styles.value}>{record.reason || '-'}</Text>
                </View>
                <View className={styles.recordTag}>
                  <Text className={styles.label}>操作人:</Text>
                  <Text className={styles.value}>{record.operator}</Text>
                </View>
              </View>
              <Text className={styles.recordTime}>调整时间: {record.adjustedAt}</Text>
            </View>
          ))}
      </View>
    );
  };

  const renderExpandedDetail = (group: InventoryGroup) => {
    const isLoading = loadingDetail === group.key;
    if (isLoading) {
      return (
        <View className={styles.detailPanel}>
          <View className={styles.loadingTip}>加载详情中...</View>
        </View>
      );
    }

    const allUsages: InventoryDetail['usageRecords'] = [];
    const allLocks: InventoryDetail['lockRecords'] = [];
    const allAdjustments: InventoryDetail['adjustmentRecords'] = [];

    group.implants.forEach((implant) => {
      const detail = detailMap[implant.id];
      if (detail) {
        allUsages.push(...detail.usageRecords);
        allLocks.push(...detail.lockRecords);
        allAdjustments.push(...detail.adjustmentRecords);
      }
    });

    return (
      <View className={styles.detailPanel}>
        <View className={styles.detailSection}>
          <View className={styles.detailSectionHeader}>
            <Text className={styles.detailSectionTitle}>入库记录</Text>
            <Text className={styles.detailSectionCount}>共 {group.implants.length} 条</Text>
          </View>
          <View className={styles.inboundList}>
            {group.implants.map((implant) => renderInboundCard(implant))}
          </View>
        </View>

        <View className={styles.detailSection}>
          <View className={styles.detailSectionHeader}>
            <Text className={styles.detailSectionTitle}>使用病例</Text>
            <Text className={styles.detailSectionCount}>共 {allUsages.length} 条</Text>
          </View>
          {renderUsageRecords(allUsages)}
        </View>

        <View className={styles.detailSection}>
          <View className={styles.detailSectionHeader}>
            <Text className={styles.detailSectionTitle}>锁定中</Text>
            <Text className={styles.detailSectionCount}>共 {allLocks.filter((r) => r.status === 'locked').length} 条</Text>
          </View>
          {renderLockRecords(allLocks)}
        </View>

        <View className={styles.detailSection}>
          <View className={styles.detailSectionHeader}>
            <Text className={styles.detailSectionTitle}>调整记录</Text>
            <Text className={styles.detailSectionCount}>共 {allAdjustments.length} 条</Text>
          </View>
          {renderAdjustmentRecords(allAdjustments)}
        </View>

        <View
          className={styles.jumpBtn}
          onClick={() => handleJumpToQueryByBatch(group.batchNo)}
        >
          <Text className={styles.jumpBtnText}>在查询页查看完整详情 →</Text>
        </View>
      </View>
    );
  };

  const renderTableHeader = () => (
    <View className={styles.tableHeader}>
      <View className={styles.th} style={{ flex: 1.6 }}>
        <Text>品牌/规格</Text>
      </View>
      <View className={styles.th} style={{ flex: 1.2 }}>
        <Text>批号</Text>
      </View>
      <View className={styles.th}>
        <Text>期初</Text>
      </View>
      <View className={styles.th}>
        <Text>入库</Text>
      </View>
      <View className={styles.th}>
        <Text>使用</Text>
      </View>
      <View className={styles.th}>
        <Text>锁定</Text>
      </View>
      <View className={styles.th}>
        <Text>调整</Text>
      </View>
      <View className={styles.th}>
        <Text>账面</Text>
      </View>
      <View className={styles.th}>
        <Text>可用</Text>
      </View>
      <View className={styles.th}>
        <Text>差异</Text>
      </View>
    </View>
  );

  const renderGroupRow = (group: InventoryGroup) => {
    const isExpanded = expandedKey === group.key;
    const hasDiff = group.difference !== 0;
    return (
      <View key={group.key} className={styles.rowWrap}>
        <View
          className={classnames(styles.tableRow, isExpanded && styles.rowExpanded)}
          onClick={() => handleRowClick(group)}
        >
          <View className={styles.td} style={{ flex: 1.6 }}>
            <Text className={styles.brandText}>{group.brand}</Text>
            <Text className={styles.specText}>{group.spec}</Text>
          </View>
          <View className={classnames(styles.td, styles.batchCell)} style={{ flex: 1.2 }}>
            <Text className={styles.batchText}>{group.batchNo}</Text>
          </View>
          <View className={styles.td}>
            <Text>{group.openingQuantity}</Text>
          </View>
          <View className={styles.td}>
            <Text className={styles.colorInbound}>{group.inboundQuantity}</Text>
          </View>
          <View className={styles.td}>
            <Text className={styles.colorUsed}>{group.usedQuantity}</Text>
          </View>
          <View className={styles.td}>
            <Text className={styles.colorLocked}>{group.lockedQuantity}</Text>
          </View>
          <View className={styles.td}>
            <Text className={styles.colorAdjusted}>{group.adjustedQuantity}</Text>
          </View>
          <View className={styles.td}>
            <Text className={styles.colorClosing}>{group.closingQuantity}</Text>
          </View>
          <View className={styles.td}>
            <Text className={styles.colorAvailable}>{group.availableQuantity}</Text>
          </View>
          <View className={styles.td}>
            <Text className={classnames(hasDiff && styles.colorDifference)}>
              {group.difference > 0 ? `+${group.difference}` : group.difference}
            </Text>
          </View>
          <View className={classnames(styles.expandIcon, isExpanded && styles.expandIconRotated)}>
            <Text>›</Text>
          </View>
        </View>
        {isExpanded && renderExpandedDetail(group)}
      </View>
    );
  };

  return (
    <View className={styles.page}>
      <ScrollView scrollY className={styles.scrollWrap}>
        <View className={styles.header}>
          <Text className={styles.headerTitle}>月底盘点</Text>
          <Text className={styles.headerSubtitle}>按品牌/规格/批号统计库存变动与差异</Text>
        </View>

        <View className={styles.filterSection}>
          <View className={styles.dateRow}>
            <View className={styles.dateItem}>
              <Text className={styles.dateLabel}>起始日期</Text>
              <Picker
                mode='date'
                value={startDateOptions.value}
                start={startDateOptions.start}
                end={startDateOptions.end}
                onChange={(e) => setStartDate(e.detail.value)}
              >
                <View className={styles.datePicker}>
                  <Text className={styles.dateValue}>{startDate}</Text>
                  <Text className={styles.datePickerIcon}>📅</Text>
                </View>
              </Picker>
            </View>
            <Text className={styles.dateSeparator}>—</Text>
            <View className={styles.dateItem}>
              <Text className={styles.dateLabel}>结束日期</Text>
              <Picker
                mode='date'
                value={endDateOptions.value}
                start={endDateOptions.start}
                end={endDateOptions.end}
                onChange={(e) => setEndDate(e.detail.value)}
              >
                <View className={styles.datePicker}>
                  <Text className={styles.dateValue}>{endDate}</Text>
                  <Text className={styles.datePickerIcon}>📅</Text>
                </View>
              </Picker>
            </View>
          </View>
        </View>

        <View className={styles.content}>
          {renderSummaryCards()}

          <View className={styles.listCard}>
            <View className={styles.listCardHeader}>
              <Text className={styles.listCardTitle}>盘点明细</Text>
              <Text className={styles.listCardCount}>共 {groups.length} 组</Text>
            </View>

            {groups.length === 0 ? (
              <View className={styles.emptyState}>
                <Text className={styles.emptyIcon}>📋</Text>
                <Text className={styles.emptyText}>当前日期范围内暂无盘点数据</Text>
              </View>
            ) : (
              <ScrollView scrollX className={styles.tableScrollX}>
                <View className={styles.tableWrap}>
                  {renderTableHeader()}
                  <View className={styles.tableBody}>
                    {groups.map((group) => renderGroupRow(group))}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>

        <View className={styles.bottomPadding} />
      </ScrollView>

      <View className={styles.footer}>
        <Button className={styles.exportBtn} onClick={handleExport}>
          <Text className={styles.exportBtnIcon}>📥</Text>
          <Text className={styles.exportBtnText}>导出盘点结果</Text>
        </Button>
      </View>

      {showExportModal && (
        <View className={styles.modalMask} onClick={closeExportModal}>
          <View className={styles.modalBox} onClick={(e) => e.stopPropagation?.()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>导出盘点结果</Text>
              <Text className={styles.modalClose} onClick={closeExportModal}>×</Text>
            </View>
            <View className={styles.modalBody}>
              <Text className={styles.modalTip}>盘点数据已生成（CSV 格式），请选择操作：</Text>
              <ScrollView scrollY className={styles.previewWrap}>
                <Text className={styles.previewText}>{exportContent}</Text>
              </ScrollView>
            </View>
            <View className={styles.modalActions}>
              <Button className={styles.modalBtnSecondary} onClick={handleCopy}>
                复制到剪贴板
              </Button>
              <Button className={styles.modalBtnPrimary} onClick={handleDownload}>
                下载文件
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default InventoryPage;
