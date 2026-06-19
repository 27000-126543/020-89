import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Input, Button, ScrollView, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { useImplantStore } from '@/store/implantStore';
import { daysUntilExpiry } from '@/utils/validator';
import type { ImplantInfo, BatchDetail, BatchSummary, AlertItem } from '@/types/implant';

type ViewMode = 'none' | 'single' | 'summary';

const QueryPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('none');
  const [selectedImplantId, setSelectedImplantId] = useState<string | null>(null);
  const [selectedBatchNo, setSelectedBatchNo] = useState<string | null>(null);
  const [showAlertPanel, setShowAlertPanel] = useState(false);

  const {
    implants,
    usageRecords,
    lockRecords,
    getBatchDetailById,
    getBatchSummary,
    searchByBatchNo,
    getAlerts
  } = useImplantStore();

  const alerts = useMemo(() => getAlerts(), [getAlerts, implants]);
  const searchResults = useMemo(() => {
    if (!searchText.trim()) return [];
    return searchByBatchNo(searchText);
  }, [searchText, searchByBatchNo]);

  const singleDetail = useMemo(() => {
    if (viewMode !== 'single' || !selectedImplantId) return null;
    return getBatchDetailById(selectedImplantId);
  }, [viewMode, selectedImplantId, getBatchDetailById, implants, usageRecords, lockRecords]);

  const batchSummary = useMemo(() => {
    if (viewMode !== 'summary' || !selectedBatchNo) return null;
    return getBatchSummary(selectedBatchNo);
  }, [viewMode, selectedBatchNo, getBatchSummary, implants, usageRecords, lockRecords]);

  useEffect(() => {
    const pages = Taro.getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const options = (currentPage as any)?.$router?.params || {};
    if (options.batchNo) {
      setSearchText(options.batchNo);
      if (options.implantId) {
        setSelectedImplantId(options.implantId);
        setViewMode('single');
      } else {
        setSelectedBatchNo(options.batchNo);
        setViewMode('summary');
      }
    }
  }, []);

  const handleSearch = () => {
    if (!searchText.trim()) {
      Taro.showToast({ title: '请输入批号', icon: 'none' });
      return;
    }

    const results = searchByBatchNo(searchText);
    if (results.length === 0) {
      Taro.showToast({ title: '未找到该批号', icon: 'none' });
      setViewMode('none');
      setSelectedImplantId(null);
      setSelectedBatchNo(null);
      return;
    }

    setShowResults(true);
  };

  const handleSelectSingle = (implant: ImplantInfo) => {
    setSelectedImplantId(implant.id);
    setSelectedBatchNo(implant.batchNo);
    setViewMode('single');
    setShowResults(false);
  };

  const handleViewSummary = (batchNo: string) => {
    setSelectedBatchNo(batchNo);
    setViewMode('summary');
    setShowResults(false);
    setSelectedImplantId(null);
  };

  const handleSwitchToSummary = () => {
    if (selectedBatchNo) {
      setViewMode('summary');
      setSelectedImplantId(null);
    }
  };

  const handleSwitchToSingle = () => {
    if (selectedBatchNo) {
      const results = searchByBatchNo(selectedBatchNo);
      if (results.length > 0) {
        setSelectedImplantId(results[0].id);
        setViewMode('single');
      }
    }
  };

  const handleClear = () => {
    setSearchText('');
    setViewMode('none');
    setSelectedImplantId(null);
    setSelectedBatchNo(null);
    setShowResults(false);
  };

  const handleInputChange = (value: string) => {
    setSearchText(value);
    setShowResults(value.trim().length > 0);
    if (!value.trim()) {
      setViewMode('none');
      setSelectedImplantId(null);
      setSelectedBatchNo(null);
    }
  };

  const handleAlertClick = (alert: AlertItem) => {
    setSearchText(alert.batchNo);
    setSelectedImplantId(alert.implantId);
    setViewMode('single');
    setShowAlertPanel(false);
  };

  const getExpiryStatus = (expiryDate: string) => {
    const days = daysUntilExpiry(expiryDate);
    if (days < 0) return { class: styles.expired, text: '已过期', days };
    if (days < 180) return { class: styles.warning, text: `临期(${days}天)`, days };
    return { class: styles.normal, text: '正常', days };
  };

  const getAlertIcon = (type: AlertItem['type']) => {
    switch (type) {
      case 'expiry_expired': return '🕐';
      case 'expiry_near': return '⏰';
      case 'stock_low': return '📦';
      default: return '⚠';
    }
  };

  const handleRefresh = () => {
    Taro.stopPullDownRefresh();
  };

  useEffect(() => {
    const unlisten = Taro.onPullDownRefresh(handleRefresh);
    return () => unlisten?.();
  }, []);

  const renderStockInfo = (stock: {
    totalQuantity: number;
    usedQuantity: number;
    usedCaseCount?: number;
    usedQuantityFromRecords?: number;
    lockedQuantity: number;
    adjustedQuantity: number;
    availableQuantity: number;
  }) => (
    <View className={styles.stockGrid}>
      <View className={styles.stockItem}>
        <Text className={classnames(styles.stockValue, styles.total)}>
          {stock.totalQuantity}
        </Text>
        <Text className={styles.stockLabel}>总数量</Text>
      </View>
      <View className={styles.stockItem}>
        <Text className={classnames(styles.stockValue, styles.used)}>
          {stock.usedQuantity}
        </Text>
        <Text className={styles.stockLabel}>已使用</Text>
      </View>
      <View className={styles.stockItem}>
        <Text className={classnames(styles.stockValue, styles.locked)}>
          {stock.lockedQuantity}
        </Text>
        <Text className={styles.stockLabel}>锁定中</Text>
      </View>
      <View className={styles.stockItem}>
        <Text className={classnames(styles.stockValue, styles.adjusted)}>
          -{stock.adjustedQuantity}
        </Text>
        <Text className={styles.stockLabel}>调整</Text>
      </View>
      <View className={styles.stockItem}>
        <Text className={classnames(styles.stockValue, styles.available)}>
          {stock.availableQuantity}
        </Text>
        <Text className={styles.stockLabel}>可用</Text>
      </View>
    </View>
  );

  const renderImplantCard = (implant: ImplantInfo) => (
    <View key={implant.id} className={styles.implantCard}>
      <View className={styles.implantHeader}>
        <View>
          <Text className={styles.implantBrand}>{implant.brand}</Text>
          <Text className={styles.implantSpec}>{implant.spec}</Text>
        </View>
        <View
          className={classnames(styles.expiryTag, getExpiryStatus(implant.expiryDate).class)}
        >
          {getExpiryStatus(implant.expiryDate).text}
        </View>
      </View>
      <View className={styles.implantInfo}>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>入库日期</Text>
          <Text className={styles.infoValue}>{implant.inboundDate}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>供应商</Text>
          <Text className={styles.infoValue}>{implant.supplier}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>有效期</Text>
          <Text className={styles.infoValue}>{implant.expiryDate}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>条码</Text>
          <Text className={styles.infoValue}>{implant.barcode}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>库存状态</Text>
          <Text className={styles.infoValue}>
            可用{implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity} / 共{implant.quantity}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderRecords = (records: any[], type: 'usage' | 'lock') => (
    <View className={styles.recordList}>
      {records
        .sort((a, b) => new Date(type === 'usage' ? b.usedAt : b.lockedAt).getTime() -
          new Date(type === 'usage' ? a.usedAt : a.lockedAt).getTime())
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
            <Text className={styles.recordTime}>
              {type === 'usage' ? '使用' : '锁定'}时间: {type === 'usage' ? record.usedAt : record.lockedAt}
            </Text>
          </View>
        ))}
    </View>
  );

  const renderAdjustmentRecords = (records: any[]) => (
    <View className={styles.recordList}>
      {records
        .sort((a, b) => new Date(b.adjustedAt).getTime() - new Date(a.adjustedAt).getTime())
        .map((record) => {
          const typeMap: Record<string, { label: string }> = {
            inventory_loss: { label: '盘亏' },
            damage: { label: '破损' },
            return: { label: '退货' },
            other: { label: '其他' }
          };
          const info = typeMap[record.type] || typeMap.other;
          return (
            <View key={record.id} className={styles.recordItem}>
              <View className={styles.recordHeader}>
                <View className={styles.adjustTypeTag}>{info.label}</View>
                <Text className={styles.recordQuantity}>-{record.quantity}</Text>
              </View>
              <View className={styles.recordInfo}>
                <View className={styles.recordTag}>
                  <Text className={styles.label}>原因:</Text>
                  <Text className={styles.value}>{record.reason}</Text>
                </View>
                <View className={styles.recordTag}>
                  <Text className={styles.label}>操作人:</Text>
                  <Text className={styles.value}>{record.operator}</Text>
                </View>
              </View>
              <Text className={styles.recordTime}>调整时间: {record.adjustedAt}</Text>
            </View>
          );
        })}
    </View>
  );

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>批号查询</Text>
        <Text className={styles.headerSubtitle}>输入批号追溯种植体全生命周期</Text>
      </View>

      {alerts.total > 0 && (
        <View className={styles.alertBanner} onClick={() => setShowAlertPanel(!showAlertPanel)}>
          <View className={styles.alertBannerContent}>
            <Text className={styles.alertBannerIcon}>⚠</Text>
            <View className={styles.alertBannerText}>
              <Text className={styles.alertBannerTitle}>
                库存提醒 ({alerts.total}项)
              </Text>
              <Text className={styles.alertBannerSubtitle}>
                {alerts.expired > 0 && `过期${alerts.expired}项 `}
                {alerts.nearExpiry > 0 && `临期${alerts.nearExpiry}项 `}
                {alerts.lowStock > 0 && `低库存${alerts.lowStock}项`}
              </Text>
            </View>
          </View>
          <Text className={styles.alertBannerArrow}>
            {showAlertPanel ? '▲' : '▼'}
          </Text>
        </View>
      )}

      {showAlertPanel && alerts.total > 0 && (
        <View className={styles.alertPanel}>
          {alerts.items.map((alert) => (
            <View
              key={alert.id}
              className={classnames(styles.alertItem, styles[alert.level])}
              onClick={() => handleAlertClick(alert)}
            >
              <Text className={styles.alertItemIcon}>{getAlertIcon(alert.type)}</Text>
              <View className={styles.alertItemContent}>
                <Text className={styles.alertItemTitle}>
                  {alert.title} · {alert.brand} {alert.spec}
                </Text>
                <Text className={styles.alertItemMessage}>{alert.message}</Text>
                <Text className={styles.alertItemBatch}>批号: {alert.batchNo}</Text>
              </View>
              <Text className={styles.alertItemArrow}>›</Text>
            </View>
          ))}
        </View>
      )}

      <View className={styles.searchSection}>
        <View className={styles.searchBox}>
          <Text className={styles.searchIcon}>⌕</Text>
          <Input
            className={styles.searchInput}
            placeholder='输入批号进行查询'
            value={searchText}
            onInput={(e) => handleInputChange(e.detail.value)}
            onConfirm={handleSearch}
            confirmType='search'
          />
          {searchText && (
            <Button className={styles.clearButton} onClick={handleClear}>
              ×
            </Button>
          )}
          <Button
            className={classnames(styles.searchButton, !searchText.trim() && styles.disabled)}
            onClick={handleSearch}
            disabled={!searchText.trim()}
          >
            搜索
          </Button>
        </View>
      </View>

      {showResults && searchResults.length > 0 && (
        <View className={styles.searchResults}>
          {searchResults.length > 1 && (
            <View
              className={styles.summaryBtn}
              onClick={() => handleViewSummary(searchResults[0].batchNo)}
            >
              <Text className={styles.summaryBtnText}>
                📊 查看该批号汇总（共{searchResults.length}条入库记录）
              </Text>
              <Text className={styles.summaryBtnArrow}>›</Text>
            </View>
          )}
          {searchResults.map((implant) => (
            <View
              key={implant.id}
              className={styles.searchResultItem}
              onClick={() => handleSelectSingle(implant)}
            >
              <View>
                <Text className={styles.resultBatchNo}>{implant.batchNo}</Text>
                <Text className={styles.resultInfo}>
                  {implant.brand} {implant.spec} · 入库 {implant.inboundDate}
                </Text>
                <Text className={styles.resultStock}>
                  可用 {implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity} / 共 {implant.quantity}
                </Text>
              </View>
              <Text className={styles.resultArrow}>›</Text>
            </View>
          ))}
        </View>
      )}

      {showResults && searchResults.length === 0 && searchText.trim() && (
        <View className={styles.noResults}>未找到匹配的批号</View>
      )}

      <View className={styles.content}>
        {viewMode === 'none' && !searchText.trim() && (
          <View className={styles.searchEmpty}>
            <Text className={styles.searchEmptyIcon}>🔍</Text>
            <Text className={styles.searchEmptyText}>请输入批号开始查询</Text>
            <View className={styles.hintSection}>
              <Text className={styles.hintText}>
                💡 输入完整或部分批号即可查询，支持模糊搜索。{'\n'}
                支持查看单条入库详情，或按批号汇总查看。
              </Text>
            </View>
          </View>
        )}

        {viewMode === 'single' && singleDetail && (
          <>
            <View className={styles.viewToggle}>
              <View className={classnames(styles.toggleTab, styles.activeToggle)}>
                <Text>单条详情</Text>
              </View>
              <View className={styles.toggleTab} onClick={handleSwitchToSummary}>
                <Text>批号汇总</Text>
              </View>
            </View>

            <View className={styles.detailCard}>
              <View className={styles.productHeader}>
                <View className={styles.productInfo}>
                  <Text className={styles.productBrand}>{singleDetail.implant.brand}</Text>
                  <Text className={styles.productSpec}>{singleDetail.implant.spec}</Text>
                </View>
                <View className={styles.batchNoTag}>
                  {singleDetail.implant.batchNo}
                </View>
              </View>

              {renderStockInfo(singleDetail.stockInfo)}

              <View className={styles.infoSection}>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>供应商</Text>
                  <Text className={styles.infoValue}>{singleDetail.implant.supplier}</Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>入库日期</Text>
                  <Text className={styles.infoValue}>{singleDetail.implant.inboundDate}</Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>有效期</Text>
                  <View className={styles.infoValue}>
                    <Text>{singleDetail.implant.expiryDate}</Text>
                    <View
                      className={classnames(
                        styles.expiryTag,
                        getExpiryStatus(singleDetail.implant.expiryDate).class
                      )}
                    >
                      {getExpiryStatus(singleDetail.implant.expiryDate).text}
                    </View>
                  </View>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>条码</Text>
                  <Text className={styles.infoValue}>{singleDetail.implant.barcode}</Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>当前状态</Text>
                  <Text className={styles.infoValue}>
                    {singleDetail.implant.status === 'in_stock' && '在库'}
                    {singleDetail.implant.status === 'partial_used' && '部分使用'}
                    {singleDetail.implant.status === 'fully_used' && '已用完'}
                    {singleDetail.implant.status === 'locked' && '锁定中'}
                    {singleDetail.implant.status === 'pending' && '待上架'}
                  </Text>
                </View>
              </View>
            </View>

            {singleDetail.lockRecords.length > 0 && (
              <View className={styles.recordsSection}>
                <View className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>锁定记录</Text>
                  <Text className={styles.sectionCount}>
                    共 {singleDetail.lockRecords.length} 条
                  </Text>
                </View>
                {renderRecords(singleDetail.lockRecords, 'lock')}
              </View>
            )}

            <View className={styles.recordsSection}>
              <View className={styles.sectionHeader}>
                <Text className={styles.sectionTitle}>使用记录</Text>
                <Text className={styles.sectionCount}>
                  共 {singleDetail.usageRecords.length} 条
                </Text>
              </View>
              {singleDetail.usageRecords.length === 0 ? (
                <View className={styles.emptyState}>暂无使用记录</View>
              ) : (
                renderRecords(singleDetail.usageRecords, 'usage')
              )}
            </View>

            {singleDetail.adjustmentRecords.length > 0 && (
              <View className={styles.recordsSection}>
                <View className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>库存调整记录</Text>
                  <Text className={styles.sectionCount}>
                    共 {singleDetail.adjustmentRecords.length} 条
                  </Text>
                </View>
                {renderAdjustmentRecords(singleDetail.adjustmentRecords)}
              </View>
            )}
          </>
        )}

        {viewMode === 'summary' && batchSummary && (
          <>
            <View className={styles.viewToggle}>
              <View className={styles.toggleTab} onClick={handleSwitchToSingle}>
                <Text>单条详情</Text>
              </View>
              <View className={classnames(styles.toggleTab, styles.activeToggle)}>
                <Text>批号汇总</Text>
              </View>
            </View>

            <View className={styles.detailCard}>
              <View className={styles.productHeader}>
                <View className={styles.productInfo}>
                  <Text className={styles.productBrand}>批号汇总</Text>
                  <Text className={styles.productSpec}>{batchSummary.batchNo}</Text>
                </View>
                <View className={styles.batchNoTag}>
                  共{batchSummary.implants.length}条入库
                </View>
              </View>

              {renderStockInfo(batchSummary.totalStock)}

              <View className={styles.caseCheckSection}>
                <View className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>病例使用核对</Text>
                </View>
                <View className={styles.caseCheckGrid}>
                  <View className={styles.caseCheckItem}>
                    <Text className={styles.caseCheckLabel}>病例条数</Text>
                    <Text className={styles.caseCheckValue}>{batchSummary.totalStock.usedCaseCount} 例</Text>
                  </View>
                  <View className={styles.caseCheckItem}>
                    <Text className={styles.caseCheckLabel}>各病例数量加总</Text>
                    <Text className={styles.caseCheckValue}>{batchSummary.totalStock.usedQuantityFromRecords} 支</Text>
                  </View>
                  <View className={styles.caseCheckItem}>
                    <Text className={styles.caseCheckLabel}>系统登记已使用</Text>
                    <Text className={styles.caseCheckValue}>{batchSummary.totalStock.usedQuantity} 支</Text>
                  </View>
                </View>
                <View className={styles.checkResultRow}>
                  <Text className={styles.checkResultLabel}>核对结果</Text>
                  {batchSummary.totalStock.usedQuantityFromRecords === batchSummary.totalStock.usedQuantity ? (
                    <Text className={classnames(styles.checkResult, styles.checkSuccess)}>✓ 核对一致</Text>
                  ) : (
                    <Text className={classnames(styles.checkResult, styles.checkWarning)}>⚠ 存在差异，请核对</Text>
                  )}
                </View>
              </View>

              <View className={styles.infoSection}>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>涉及品牌</Text>
                  <Text className={styles.infoValue}>
                    {[...new Set(batchSummary.implants.map(i => i.brand))].join('、')}
                  </Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>规格型号</Text>
                  <Text className={styles.infoValue}>
                    {batchSummary.uniqueSpecs.join('、')}
                  </Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>供应商</Text>
                  <Text className={styles.infoValue}>
                    {batchSummary.uniqueSuppliers.join('、')}
                  </Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>最早入库</Text>
                  <Text className={styles.infoValue}>
                    {dayjs(Math.min(...batchSummary.implants.map(i => new Date(i.inboundDate).getTime()))).format('YYYY-MM-DD')}
                  </Text>
                </View>
              </View>

              <View className={styles.subSectionTitle}>各入库记录</View>
              <View className={styles.implantList}>
                {batchSummary.implants.map((implant) => (
                  <View
                    key={implant.id}
                    className={styles.implantMiniCard}
                    onClick={() => handleSelectSingle(implant)}
                  >
                    <View className={styles.implantMiniHeader}>
                      <Text className={styles.implantMiniBrand}>
                        {implant.brand} {implant.spec}
                      </Text>
                      <Text className={styles.implantMiniArrow}>›</Text>
                    </View>
                    <View className={styles.implantMiniInfo}>
                      <Text>入库: {implant.inboundDate}</Text>
                      <Text>可用: {implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity}/{implant.quantity}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {batchSummary.lockRecords.length > 0 && (
              <View className={styles.recordsSection}>
                <View className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>所有锁定记录</Text>
                  <Text className={styles.sectionCount}>
                    共 {batchSummary.lockRecords.length} 条
                  </Text>
                </View>
                {renderRecords(batchSummary.lockRecords, 'lock')}
              </View>
            )}

            <View className={styles.recordsSection}>
              <View className={styles.sectionHeader}>
                <Text className={styles.sectionTitle}>所有使用记录</Text>
                <Text className={styles.sectionCount}>
                  共 {batchSummary.usageRecords.length} 条
                </Text>
              </View>
              {batchSummary.usageRecords.length === 0 ? (
                <View className={styles.emptyState}>暂无使用记录</View>
              ) : (
                renderRecords(batchSummary.usageRecords, 'usage')
              )}
            </View>

            {batchSummary.adjustmentRecords.length > 0 && (
              <View className={styles.recordsSection}>
                <View className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>所有库存调整记录</Text>
                  <Text className={styles.sectionCount}>
                    共 {batchSummary.adjustmentRecords.length} 条
                  </Text>
                </View>
                {renderAdjustmentRecords(batchSummary.adjustmentRecords)}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default QueryPage;
