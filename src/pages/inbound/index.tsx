import React, { useState, useMemo } from 'react';
import { View, Text, Input, Button, ScrollView, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { useImplantStore } from '@/store/implantStore';
import { validateImplantForm, daysUntilExpiry } from '@/utils/validator';
import type { ValidationWarning, AlertSummary, AlertItem } from '@/types/implant';
import { SUPPLIERS, BRANDS } from '@/types/implant';

interface FormData {
  barcode: string;
  brand: string;
  spec: string;
  batchNo: string;
  expiryDate: string;
  supplier: string;
  quantity: number;
}

const initialFormData: FormData = {
  barcode: '',
  brand: '',
  spec: '',
  batchNo: '',
  expiryDate: '',
  supplier: '',
  quantity: 1
};

const InboundPage: React.FC = () => {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [supplierIndex, setSupplierIndex] = useState(0);
  const [brandIndex, setBrandIndex] = useState(0);
  const [showAlertPanel, setShowAlertPanel] = useState(false);

  const {
    pendingItems,
    implants,
    addPendingItem,
    removePendingItem,
    confirmInbound,
    getExistingBatchNos,
    getAlerts
  } = useImplantStore();

  const existingBatchNos = useMemo(() => getExistingBatchNos(), [getExistingBatchNos, implants, pendingItems]);
  const alerts = useMemo(() => getAlerts(), [getAlerts, implants]);

  const warnings = useMemo(() => {
    if (!formData.batchNo || !formData.expiryDate) return [];
    return validateImplantForm(
      { batchNo: formData.batchNo, expiryDate: formData.expiryDate },
      existingBatchNos
    );
  }, [formData.batchNo, formData.expiryDate, existingBatchNos]);

  const hasError = warnings.some((w) => w.level === 'error');
  const isFormValid = formData.brand && formData.spec && formData.batchNo &&
    formData.expiryDate && formData.supplier && formData.quantity > 0;

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleScan = () => {
    Taro.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        console.log('[Inbound] 扫码结果:', res);
        handleInputChange('barcode', res.result);
        Taro.showToast({ title: '扫码成功', icon: 'success' });
      },
      fail: (err) => {
        console.error('[Inbound] 扫码失败:', err);
        Taro.showToast({ title: '扫码失败', icon: 'none' });
      }
    });
  };

  const handleAddToPending = () => {
    if (!isFormValid) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    if (hasError) {
      Taro.showModal({
        title: '存在错误',
        content: '请先修正红色错误提示后再添加',
        showCancel: false
      });
      return;
    }

    const hasDuplicatePending = pendingItems.some((item) => item.batchNo === formData.batchNo);
    if (hasDuplicatePending) {
      Taro.showModal({
        title: '批号已在待上架中',
        content: `该批号「${formData.batchNo}」已在待上架清单中，是否确认继续添加？`,
        confirmText: '继续添加',
        success: (res) => {
          if (!res.confirm) return;
          doAddToPending();
        }
      });
    } else {
      const hasDuplicateInStock = existingBatchNos.includes(formData.batchNo);
      if (hasDuplicateInStock) {
        Taro.showModal({
          title: '批号核对提醒',
          content: `该批号「${formData.batchNo}」历史已入库，建议核对规格、供应商是否一致。是否继续添加？`,
          confirmText: '继续添加',
          success: (res) => {
            if (!res.confirm) return;
            doAddToPending();
          }
        });
      } else {
        doAddToPending();
      }
    }
  };

  const doAddToPending = () => {
    addPendingItem({
      barcode: formData.barcode,
      brand: formData.brand,
      spec: formData.spec,
      batchNo: formData.batchNo,
      expiryDate: formData.expiryDate,
      supplier: formData.supplier,
      quantity: formData.quantity,
      warnings
    });

    setFormData(initialFormData);
    setSupplierIndex(0);
    setBrandIndex(0);

    Taro.showToast({ title: '已添加到待上架', icon: 'success' });
  };

  const handleRemovePending = (id: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要从待上架清单中移除吗？',
      success: (res) => {
        if (res.confirm) {
          removePendingItem(id);
        }
      }
    });
  };

  const handleConfirmInbound = () => {
    if (pendingItems.length === 0) {
      Taro.showToast({ title: '待上架清单为空', icon: 'none' });
      return;
    }

    const hasErrors = pendingItems.some((item) =>
      item.warnings.some((w) => w.level === 'error')
    );

    if (hasErrors) {
      Taro.showModal({
        title: '存在错误项',
        content: '待上架清单中存在错误项，请先处理后再确认入库',
        showCancel: false
      });
      return;
    }

    Taro.showModal({
      title: '确认入库',
      content: `确定将 ${pendingItems.length} 项种植体入库吗？`,
      success: (res) => {
        if (res.confirm) {
          const newImplants = confirmInbound();
          if (newImplants.length > 0) {
            Taro.showToast({ 
              title: `入库成功，共${newImplants.length}项`, 
              icon: 'success' 
            });
          }
        }
      }
    });
  };

  const handleAlertClick = (alert: AlertItem) => {
    Taro.navigateTo({
      url: `/pages/query/index?batchNo=${alert.batchNo}&implantId=${alert.implantId}`
    });
  };

  const handleViewAllAlerts = () => {
    setShowAlertPanel(!showAlertPanel);
  };

  const getExpiryClass = (expiryDate: string) => {
    const days = daysUntilExpiry(expiryDate);
    if (days < 0) return styles.expiryError;
    if (days < 180) return styles.expiryWarning;
    return '';
  };

  const renderWarningIcon = (level: ValidationWarning['level']) => {
    return level === 'error' ? '!' : '⚠';
  };

  const getAlertIcon = (type: AlertItem['type']) => {
    switch (type) {
      case 'expiry_expired': return '🕐';
      case 'expiry_near': return '⏰';
      case 'stock_low': return '📦';
      default: return '⚠';
    }
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>入库登记</Text>
        <Text className={styles.headerSubtitle}>扫描条码或手动录入种植体信息</Text>
      </View>

      {alerts.total > 0 && (
        <View className={styles.alertBanner} onClick={handleViewAllAlerts}>
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
          {alerts.items.slice(0, 5).map((alert) => (
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
          {alerts.items.length > 5 && (
            <View className={styles.alertMore}>
              还有 {alerts.items.length - 5} 项提醒，点击查询页查看全部
            </View>
          )}
        </View>
      )}

      <View className={styles.formSection}>
        <View className={styles.formItem}>
          <Text className={styles.formLabel}>条码</Text>
          <Input
            className={styles.formInput}
            placeholder='扫描或输入条码'
            value={formData.barcode}
            onInput={(e) => handleInputChange('barcode', e.detail.value)}
          />
        </View>

        <View className={styles.formRow}>
          <View className={styles.formItem}>
            <Text className={styles.formLabel}>品牌</Text>
            <Picker
              mode='selector'
              range={BRANDS}
              value={brandIndex}
              onChange={(e) => {
                const idx = Number(e.detail.value);
                setBrandIndex(idx);
                handleInputChange('brand', BRANDS[idx]);
              }}
            >
              <View className={styles.formInput}>
                {formData.brand || '请选择品牌'}
              </View>
            </Picker>
          </View>

          <View className={styles.formItem}>
            <Text className={styles.formLabel}>规格</Text>
            <Input
              className={styles.formInput}
              placeholder='如: 4.1x10mm'
              value={formData.spec}
              onInput={(e) => handleInputChange('spec', e.detail.value)}
            />
          </View>
        </View>

        <View className={styles.formItem}>
          <Text className={styles.formLabel}>批号</Text>
          <Input
            className={styles.formInput}
            placeholder='输入产品批号'
            value={formData.batchNo}
            onInput={(e) => handleInputChange('batchNo', e.detail.value)}
          />
        </View>

        <View className={styles.formRow}>
          <View className={styles.formItem}>
            <Text className={styles.formLabel}>有效期</Text>
            <Picker
              mode='date'
              value={formData.expiryDate}
              start={dayjs().format('YYYY-MM-DD')}
              onChange={(e) => handleInputChange('expiryDate', e.detail.value)}
            >
              <View className={styles.formInput}>
                {formData.expiryDate || '选择有效期'}
              </View>
            </Picker>
          </View>

          <View className={styles.formItem}>
            <Text className={styles.formLabel}>数量</Text>
            <Input
              className={styles.formInput}
              type='number'
              placeholder='数量'
              value={String(formData.quantity)}
              onInput={(e) => handleInputChange('quantity', Number(e.detail.value) || 0)}
            />
          </View>
        </View>

        <View className={styles.formItem}>
          <Text className={styles.formLabel}>供应商</Text>
          <Picker
            mode='selector'
            range={SUPPLIERS}
            value={supplierIndex}
            onChange={(e) => {
              const idx = Number(e.detail.value);
              setSupplierIndex(idx);
              handleInputChange('supplier', SUPPLIERS[idx]);
            }}
          >
            <View className={styles.formInput}>
              {formData.supplier || '请选择供应商'}
            </View>
          </Picker>
        </View>
      </View>

      {warnings.length > 0 && (
        <View className={styles.warningsContainer}>
          {warnings.map((warning, idx) => (
            <View
              key={idx}
              className={classnames(styles.warningCard, styles[warning.level])}
            >
              <Text className={styles.warningIcon}>{renderWarningIcon(warning.level)}</Text>
              <Text className={styles.warningText}>{warning.message}</Text>
            </View>
          ))}
        </View>
      )}

      <Button
        className={classnames(styles.addButton, !isFormValid && styles.disabled)}
        onClick={handleAddToPending}
        disabled={!isFormValid}
      >
        添加到待上架
      </Button>

      <View className={styles.pendingSection}>
        <View className={styles.sectionTitle}>
          <Text>待上架清单</Text>
          <Text className={styles.badge}>{pendingItems.length}</Text>
        </View>

        {pendingItems.length === 0 ? (
          <View className={styles.emptyState}>暂无待上架项</View>
        ) : (
          <View className={styles.pendingList}>
            {pendingItems.map((item) => (
              <View key={item.id} className={styles.pendingItem}>
                <View className={styles.itemHeader}>
                  <View>
                    <Text className={styles.itemBrand}>{item.brand}</Text>
                    <Text className={styles.itemSpec}>{item.spec}</Text>
                  </View>
                  <Button
                    className={styles.deleteBtn}
                    onClick={() => handleRemovePending(item.id)}
                  >
                    ×
                  </Button>
                </View>

                <View className={styles.itemInfo}>
                  <View className={styles.infoTag}>
                    批号
                    <Text className={styles.highlight}>{item.batchNo}</Text>
                  </View>
                  <View className={classnames(styles.infoTag, getExpiryClass(item.expiryDate))}>
                    有效期
                    <Text className={styles.highlight}>{item.expiryDate}</Text>
                  </View>
                  <View className={styles.infoTag}>
                    供应商
                    <Text className={styles.highlight}>{item.supplier}</Text>
                  </View>
                  <View className={styles.infoTag}>
                    数量
                    <Text className={styles.highlight}>{item.quantity}</Text>
                  </View>
                </View>

                {item.warnings.length > 0 && (
                  <View className={styles.itemWarnings}>
                    {item.warnings.map((w, idx) => (
                      <View
                        key={idx}
                        className={classnames(styles.itemWarning, styles[w.level])}
                      >
                        {w.message}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View className={styles.footerBar}>
        <Button className={styles.scanButton} onClick={handleScan}>
          <Text className={styles.scanIcon}>⌖</Text>
          <Text>扫码</Text>
        </Button>
        <Button
          className={classnames(styles.confirmButton, pendingItems.length === 0 && styles.disabled)}
          onClick={handleConfirmInbound}
          disabled={pendingItems.length === 0}
        >
          确认入库 ({pendingItems.length})
        </Button>
      </View>
    </ScrollView>
  );
};

export default InboundPage;
