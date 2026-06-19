import React, { useState, useMemo } from 'react';
import { View, Text, Input, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { useImplantStore } from '@/store/implantStore';
import { daysUntilExpiry } from '@/utils/validator';
import type { ImplantInfo, BatchDetail } from '@/types/implant';

const QueryPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null);
  const [showResults, setShowResults] = useState(false);

  const { implants, usageRecords, getBatchDetail, searchByBatchNo } = useImplantStore();

  const searchResults = useMemo(() => {
    if (!searchText.trim()) return [];
    return searchByBatchNo(searchText);
  }, [searchText, searchByBatchNo]);

  const handleSearch = () => {
    if (!searchText.trim()) {
      Taro.showToast({ title: '请输入批号', icon: 'none' });
      return;
    }

    const results = searchByBatchNo(searchText);
    if (results.length === 0) {
      Taro.showToast({ title: '未找到该批号', icon: 'none' });
      setSelectedBatch(null);
      return;
    }

    if (results.length === 1) {
      const detail = getBatchDetail(results[0].batchNo);
      setSelectedBatch(detail);
      setShowResults(false);
    } else {
      setShowResults(true);
    }
  };

  const handleSelectResult = (implant: ImplantInfo) => {
    const detail = getBatchDetail(implant.batchNo);
    setSelectedBatch(detail);
    setShowResults(false);
  };

  const handleClear = () => {
    setSearchText('');
    setSelectedBatch(null);
    setShowResults(false);
  };

  const handleInputChange = (value: string) => {
    setSearchText(value);
    setShowResults(value.trim().length > 0);
    if (!value.trim()) {
      setSelectedBatch(null);
    }
  };

  const getExpiryStatus = (expiryDate: string) => {
    const days = daysUntilExpiry(expiryDate);
    if (days < 0) return { class: styles.expired, text: '已过期', days };
    if (days < 180) return { class: styles.warning, text: `临期(${days}天)`, days };
    return { class: styles.normal, text: '正常', days };
  };

  const handleRefresh = () => {
    Taro.stopPullDownRefresh();
    if (selectedBatch) {
      const latest = getBatchDetail(selectedBatch.implant.batchNo);
      if (latest) setSelectedBatch(latest);
    }
  };

  React.useEffect(() => {
    const unlisten = Taro.onPullDownRefresh(handleRefresh);
    return () => unlisten?.();
  }, [selectedBatch, implants, usageRecords]);

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>批号查询</Text>
        <Text className={styles.headerSubtitle}>输入批号追溯种植体全生命周期</Text>
      </View>

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
          {searchResults.map((implant) => (
            <View
              key={implant.id}
              className={styles.searchResultItem}
              onClick={() => handleSelectResult(implant)}
            >
              <View>
                <Text className={styles.resultBatchNo}>{implant.batchNo}</Text>
                <Text className={styles.resultInfo}>
                  {implant.brand} {implant.spec} · 库存 {implant.quantity - implant.usedQuantity - implant.lockedQuantity}
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
        {!selectedBatch && !searchText.trim() && (
          <>
            <View className={styles.hintSection}>
              <Text className={styles.hintText}>
                💡 输入完整或部分批号即可查询，支持模糊搜索。{'\n'}
                可查看入库来源、当前库存、已使用病例和未使用数量。
              </Text>
            </View>
            <View className={styles.searchEmpty}>
              <Text className={styles.searchEmptyIcon}>🔍</Text>
              <Text className={styles.searchEmptyText}>请输入批号开始查询</Text>
            </View>
          </>
        )}

        {selectedBatch && (
          <>
            <View className={styles.detailCard}>
              <View className={styles.productHeader}>
                <View className={styles.productInfo}>
                  <Text className={styles.productBrand}>{selectedBatch.implant.brand}</Text>
                  <Text className={styles.productSpec}>{selectedBatch.implant.spec}</Text>
                </View>
                <View className={styles.batchNoTag}>
                  {selectedBatch.implant.batchNo}
                </View>
              </View>

              <View className={styles.stockGrid}>
                <View className={styles.stockItem}>
                  <Text className={classnames(styles.stockValue, styles.total)}>
                    {selectedBatch.stockInfo.totalQuantity}
                  </Text>
                  <Text className={styles.stockLabel}>总数量</Text>
                </View>
                <View className={styles.stockItem}>
                  <Text className={classnames(styles.stockValue, styles.used)}>
                    {selectedBatch.stockInfo.usedQuantity}
                  </Text>
                  <Text className={styles.stockLabel}>已使用</Text>
                </View>
                <View className={styles.stockItem}>
                  <Text className={classnames(styles.stockValue, styles.locked)}>
                    {selectedBatch.stockInfo.lockedQuantity}
                  </Text>
                  <Text className={styles.stockLabel}>锁定中</Text>
                </View>
                <View className={styles.stockItem}>
                  <Text className={classnames(styles.stockValue, styles.available)}>
                    {selectedBatch.stockInfo.availableQuantity}
                  </Text>
                  <Text className={styles.stockLabel}>可用</Text>
                </View>
              </View>

              <View className={styles.infoSection}>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>供应商</Text>
                  <Text className={styles.infoValue}>{selectedBatch.implant.supplier}</Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>入库日期</Text>
                  <Text className={styles.infoValue}>{selectedBatch.implant.inboundDate}</Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>有效期</Text>
                  <View className={styles.infoValue}>
                    <Text>{selectedBatch.implant.expiryDate}</Text>
                    <View
                      className={classnames(
                        styles.expiryTag,
                        getExpiryStatus(selectedBatch.implant.expiryDate).class
                      )}
                    >
                      {getExpiryStatus(selectedBatch.implant.expiryDate).text}
                    </View>
                  </View>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>条码</Text>
                  <Text className={styles.infoValue}>{selectedBatch.implant.barcode}</Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>当前状态</Text>
                  <Text className={styles.infoValue}>
                    {selectedBatch.implant.status === 'in_stock' && '在库'}
                    {selectedBatch.implant.status === 'partial_used' && '部分使用'}
                    {selectedBatch.implant.status === 'fully_used' && '已用完'}
                    {selectedBatch.implant.status === 'locked' && '锁定中'}
                    {selectedBatch.implant.status === 'pending' && '待上架'}
                  </Text>
                </View>
              </View>
            </View>

            <View className={styles.recordsSection}>
              <View className={styles.sectionHeader}>
                <Text className={styles.sectionTitle}>使用记录</Text>
                <Text className={styles.sectionCount}>
                  共 {selectedBatch.usageRecords.length} 条
                </Text>
              </View>

              {selectedBatch.usageRecords.length === 0 ? (
                <View className={styles.emptyState}>暂无使用记录</View>
              ) : (
                <View className={styles.recordList}>
                  {selectedBatch.usageRecords
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
                        <Text className={styles.recordTime}>领用时间: {record.usedAt}</Text>
                      </View>
                    ))}
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default QueryPage;
