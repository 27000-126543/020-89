import React, { useState, useMemo } from 'react';
import { View, Text, Input, Button, Picker, ScrollView, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { useImplantStore } from '@/store/implantStore';
import { daysUntilExpiry } from '@/utils/validator';
import type { ImplantInfo, AdjustmentType, AdjustmentRecord } from '@/types/implant';

const ADJUSTMENT_TYPE_OPTIONS: { value: AdjustmentType; label: string; color: string }[] = [
  { value: 'inventory_loss', label: '盘亏', color: 'loss' },
  { value: 'damage', label: '破损', color: 'damage' },
  { value: 'return', label: '退货', color: 'return' },
  { value: 'other', label: '其他', color: 'other' }
];

const FILTER_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  ...ADJUSTMENT_TYPE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))
];

const AdjustmentPage: React.FC = () => {
  const { searchByBatchNo, getBatchDetailById, createAdjustment, adjustmentRecords } = useImplantStore();

  const [batchSearchText, setBatchSearchText] = useState('');
  const [showBatchResults, setShowBatchResults] = useState(false);
  const [selectedImplant, setSelectedImplant] = useState<ImplantInfo | null>(null);
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<ReturnType<typeof getBatchDetailById>>(null);

  const [adjustmentTypeIndex, setAdjustmentTypeIndex] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [operator, setOperator] = useState('');

  const [filterTypeIndex, setFilterTypeIndex] = useState(0);
  const [filterBatchNo, setFilterBatchNo] = useState('');

  const batchSearchResults = useMemo(() => {
    if (!batchSearchText.trim()) return [];
    return searchByBatchNo(batchSearchText).filter(implant => {
      const available = implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity;
      return available > 0;
    });
  }, [batchSearchText, searchByBatchNo]);

  const availableQuantity = useMemo(() => {
    if (!selectedBatchDetail) return 0;
    return selectedBatchDetail.stockInfo.availableQuantity;
  }, [selectedBatchDetail]);

  const filteredRecords = useMemo(() => {
    let records = [...adjustmentRecords];

    const filterType = FILTER_TYPE_OPTIONS[filterTypeIndex]?.value;
    if (filterType && filterType !== 'all') {
      records = records.filter(r => r.type === filterType);
    }

    if (filterBatchNo.trim()) {
      const keyword = filterBatchNo.toLowerCase();
      records = records.filter(r => r.batchNo.toLowerCase().includes(keyword));
    }

    return records.sort((a, b) => new Date(b.adjustedAt).getTime() - new Date(a.adjustedAt).getTime());
  }, [adjustmentRecords, filterTypeIndex, filterBatchNo]);

  const handleSelectImplant = (implant: ImplantInfo) => {
    setSelectedImplant(implant);
    const detail = getBatchDetailById(implant.id);
    setSelectedBatchDetail(detail);
    setShowBatchResults(false);
    setBatchSearchText(implant.batchNo);
  };

  const handleClearSelection = () => {
    setSelectedImplant(null);
    setSelectedBatchDetail(null);
    setBatchSearchText('');
    setQuantity('');
    setAdjustmentTypeIndex(0);
  };

  const getExpiryStatus = (expiryDate: string) => {
    const days = daysUntilExpiry(expiryDate);
    if (days < 0) return { class: styles.expired, text: '已过期', days };
    if (days < 180) return { class: styles.warning, text: `临期(${days}天)`, days };
    return { class: styles.normal, text: '正常', days };
  };

  const getAdjustmentTypeInfo = (type: AdjustmentType) => {
    return ADJUSTMENT_TYPE_OPTIONS.find(opt => opt.value === type) || ADJUSTMENT_TYPE_OPTIONS[3];
  };

  const validateForm = (): boolean => {
    if (!selectedImplant) {
      Taro.showToast({ title: '请先选择批次', icon: 'none' });
      return false;
    }

    const qty = parseInt(quantity, 10);
    if (!quantity || isNaN(qty) || qty <= 0) {
      Taro.showToast({ title: '请输入有效的调整数量', icon: 'none' });
      return false;
    }

    if (qty > availableQuantity) {
      Taro.showToast({ title: `调整数量不能超过可用数量${availableQuantity}`, icon: 'none' });
      return false;
    }

    if (!reason.trim()) {
      Taro.showToast({ title: '请输入调整原因', icon: 'none' });
      return false;
    }

    if (!operator.trim()) {
      Taro.showToast({ title: '请输入操作人', icon: 'none' });
      return false;
    }

    return true;
  };

  const handleConfirmAdjustment = () => {
    if (!validateForm() || !selectedImplant || !selectedBatchDetail) return;

    const qty = parseInt(quantity, 10);
    const adjustmentType = ADJUSTMENT_TYPE_OPTIONS[adjustmentTypeIndex].value;

    const result = createAdjustment({
      implantId: selectedImplant.id,
      batchNo: selectedImplant.batchNo,
      brand: selectedImplant.brand,
      spec: selectedImplant.spec,
      type: adjustmentType,
      quantity: qty,
      reason: reason.trim(),
      operator: operator.trim()
    });

    if (result) {
      Taro.showToast({ title: '调整成功', icon: 'success' });
      const updatedDetail = getBatchDetailById(selectedImplant.id);
      setSelectedBatchDetail(updatedDetail);
      setQuantity('');
      setReason('');
      setAdjustmentTypeIndex(0);

      if (updatedDetail && updatedDetail.stockInfo.availableQuantity <= 0) {
        setSelectedImplant(null);
        setSelectedBatchDetail(null);
        setBatchSearchText('');
      }
    } else {
      Taro.showToast({ title: '调整失败，请重试', icon: 'none' });
    }
  };

  const handleRecordClick = (record: AdjustmentRecord) => {
    Taro.navigateTo({
      url: `/pages/query/index?batchNo=${encodeURIComponent(record.batchNo)}`
    });
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>库存调整</Text>
        <Text className={styles.headerSubtitle}>登记盘亏、破损、退货等库存变动</Text>
      </View>

      <View className={styles.formSection}>
        <View className={styles.sectionTitleRow}>
          <Text className={styles.sectionTitle}>📝 调整登记</Text>
        </View>

        <View className={styles.formCard}>
          <View className={styles.formItem}>
            <Text className={styles.formLabel}>
              <Text className={styles.required}>*</Text>批号搜索
            </Text>
            <View className={styles.searchBox}>
              <Text className={styles.searchIcon}>⌕</Text>
              <Input
                className={styles.searchInput}
                placeholder='输入批号搜索可用批次'
                value={batchSearchText}
                onInput={(e) => {
                  setBatchSearchText(e.detail.value);
                  setShowBatchResults(true);
                  if (!e.detail.value.trim()) {
                    handleClearSelection();
                  }
                }}
                confirmType='search'
              />
              {batchSearchText && (
                <Button className={styles.clearButton} onClick={handleClearSelection}>
                  ×
                </Button>
              )}
            </View>

            {showBatchResults && batchSearchText.trim() && (
              <View className={styles.searchResults}>
                {batchSearchResults.length > 0 ? (
                  batchSearchResults.map((implant) => (
                    <View
                      key={implant.id}
                      className={styles.searchResultItem}
                      onClick={() => handleSelectImplant(implant)}
                    >
                      <View className={styles.resultMain}>
                        <Text className={styles.resultBatchNo}>{implant.batchNo}</Text>
                        <Text className={styles.resultInfo}>
                          {implant.brand} {implant.spec}
                        </Text>
                        <Text className={styles.resultStock}>
                          可用 {implant.quantity - implant.usedQuantity - implant.lockedQuantity - implant.adjustedQuantity} / 共 {implant.quantity}
                        </Text>
                      </View>
                      <Text className={styles.resultArrow}>›</Text>
                    </View>
                  ))
                ) : (
                  <View className={styles.noResults}>未找到可用批次</View>
                )}
              </View>
            )}
          </View>

          {selectedImplant && selectedBatchDetail && (
            <View className={styles.batchInfoCard}>
              <View className={styles.batchInfoHeader}>
                <View className={styles.batchInfoMain}>
                  <Text className={styles.brandText}>{selectedImplant.brand}</Text>
                  <Text className={styles.specText}>{selectedImplant.spec}</Text>
                </View>
                <View className={styles.batchNoTag}>{selectedImplant.batchNo}</View>
              </View>

              <View className={styles.batchInfoGrid}>
                <View className={styles.infoTile}>
                  <Text className={styles.infoTileValue}>
                    {selectedBatchDetail.stockInfo.availableQuantity}
                  </Text>
                  <Text className={styles.infoTileLabel}>当前可用</Text>
                </View>
                <View className={styles.infoTile}>
                  <Text
                    className={classnames(
                      styles.expiryTag,
                      getExpiryStatus(selectedImplant.expiryDate).class
                    )}
                  >
                    {getExpiryStatus(selectedImplant.expiryDate).text}
                  </Text>
                  <Text className={styles.infoTileLabel}>{selectedImplant.expiryDate}</Text>
                </View>
              </View>
            </View>
          )}

          <View className={styles.formItem}>
            <Text className={styles.formLabel}>
              <Text className={styles.required}>*</Text>调整类型
            </Text>
            <Picker
              mode='selector'
              range={ADJUSTMENT_TYPE_OPTIONS.map(opt => opt.label)}
              value={adjustmentTypeIndex}
              onChange={(e) => setAdjustmentTypeIndex(Number(e.detail.value))}
            >
              <View className={styles.pickerBox}>
                <View className={classnames(
                  styles.typeTag,
                  styles[ADJUSTMENT_TYPE_OPTIONS[adjustmentTypeIndex].color]
                )}>
                  {ADJUSTMENT_TYPE_OPTIONS[adjustmentTypeIndex].label}
                </View>
                <Text className={styles.pickerArrow}>▼</Text>
              </View>
            </Picker>
          </View>

          <View className={styles.formItem}>
            <Text className={styles.formLabel}>
              <Text className={styles.required}>*</Text>调整数量
              {availableQuantity > 0 && (
                <Text className={styles.quantityHint}>（最多 {availableQuantity}）</Text>
              )}
            </Text>
            <Input
              className={styles.inputBox}
              type='number'
              placeholder='请输入调整数量'
              value={quantity}
              onInput={(e) => {
                const val = e.detail.value.replace(/[^\d]/g, '');
                setQuantity(val);
              }}
            />
          </View>

          <View className={styles.formItem}>
            <Text className={styles.formLabel}>
              <Text className={styles.required}>*</Text>调整原因
            </Text>
            <Textarea
              className={styles.textareaBox}
              placeholder='请详细描述调整原因'
              value={reason}
              onInput={(e) => setReason(e.detail.value)}
              maxlength={200}
            />
            <Text className={styles.charCount}>{reason.length}/200</Text>
          </View>

          <View className={styles.formItem}>
            <Text className={styles.formLabel}>
              <Text className={styles.required}>*</Text>操作人
            </Text>
            <Input
              className={styles.inputBox}
              placeholder='请输入操作人姓名'
              value={operator}
              onInput={(e) => setOperator(e.detail.value)}
            />
          </View>

          <Button
            className={classnames(
              styles.confirmButton,
              (!selectedImplant || !quantity || !reason || !operator) && styles.disabled
            )}
            onClick={handleConfirmAdjustment}
            disabled={!selectedImplant || !quantity || !reason || !operator}
          >
            确认调整
          </Button>
        </View>
      </View>

      <View className={styles.recordsSection}>
        <View className={styles.sectionTitleRow}>
          <Text className={styles.sectionTitle}>📋 调整记录</Text>
          <Text className={styles.sectionCount}>共 {filteredRecords.length} 条</Text>
        </View>

        <View className={styles.filterCard}>
          <View className={styles.filterRow}>
            <View className={styles.filterItem}>
              <Picker
                mode='selector'
                range={FILTER_TYPE_OPTIONS.map(opt => opt.label)}
                value={filterTypeIndex}
                onChange={(e) => setFilterTypeIndex(Number(e.detail.value))}
              >
                <View className={styles.filterPicker}>
                  <Text>{FILTER_TYPE_OPTIONS[filterTypeIndex].label}</Text>
                  <Text className={styles.pickerArrow}>▼</Text>
                </View>
              </Picker>
            </View>
            <View className={styles.filterSearch}>
              <Text className={styles.searchIcon}>⌕</Text>
              <Input
                className={styles.filterInput}
                placeholder='批号搜索'
                value={filterBatchNo}
                onInput={(e) => setFilterBatchNo(e.detail.value)}
              />
              {filterBatchNo && (
                <Button className={styles.clearButton} onClick={() => setFilterBatchNo('')}>
                  ×
                </Button>
              )}
            </View>
          </View>
        </View>

        {filteredRecords.length > 0 ? (
          <View className={styles.recordList}>
            {filteredRecords.map((record) => {
              const typeInfo = getAdjustmentTypeInfo(record.type);
              return (
                <View
                  key={record.id}
                  className={styles.recordCard}
                  onClick={() => handleRecordClick(record)}
                >
                  <View className={styles.recordHeader}>
                    <View className={classnames(styles.typeTag, styles[typeInfo.color])}>
                      {typeInfo.label}
                    </View>
                    <Text className={styles.recordQuantity}>-{record.quantity}</Text>
                  </View>

                  <View className={styles.recordProductRow}>
                    <Text className={styles.recordBrandSpec}>
                      {record.brand} {record.spec}
                    </Text>
                    <Text className={styles.recordBatchNo}>{record.batchNo}</Text>
                  </View>

                  <Text className={styles.recordReason}>{record.reason}</Text>

                  <View className={styles.recordFooter}>
                    <Text className={styles.recordOperator}>操作人：{record.operator}</Text>
                    <Text className={styles.recordTime}>{record.adjustedAt}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📭</Text>
            <Text className={styles.emptyText}>暂无调整记录</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default AdjustmentPage;
