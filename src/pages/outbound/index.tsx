import React, { useState, useMemo } from 'react';
import { View, Text, Input, Button, ScrollView, Picker, Swiper, SwiperItem } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { useImplantStore } from '@/store/implantStore';
import { daysUntilExpiry } from '@/utils/validator';
import type { ImplantInfo, UsageRecord } from '@/types/implant';
import { DOCTORS } from '@/types/implant';

interface UsageForm {
  doctorIndex: number;
  patientInitial: string;
  patientId: string;
  surgeryDate: string;
  quantity: number;
}

interface ConfirmedUsage {
  implant: ImplantInfo;
  record: UsageRecord;
}

const initialForm: UsageForm = {
  doctorIndex: 0,
  patientInitial: '',
  patientId: '',
  surgeryDate: dayjs().format('YYYY-MM-DD'),
  quantity: 1
};

const OutboundPage: React.FC = () => {
  const [selectedImplant, setSelectedImplant] = useState<ImplantInfo | null>(null);
  const [formData, setFormData] = useState<UsageForm>(initialForm);
  const [confirmedUsage, setConfirmedUsage] = useState<ConfirmedUsage | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { implants, usageRecords, lockImplant, confirmUsage, getAvailableImplants } = useImplantStore();

  const availableImplants = useMemo(() => getAvailableImplants(), [getAvailableImplants]);

  const recentRecords = useMemo(() => {
    return [...usageRecords]
      .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
      .slice(0, 10);
  }, [usageRecords]);

  const availableQuantity = useMemo(() => {
    if (!selectedImplant) return 0;
    return selectedImplant.quantity - selectedImplant.usedQuantity - selectedImplant.lockedQuantity;
  }, [selectedImplant]);

  const isFormValid = selectedImplant &&
    formData.patientInitial &&
    formData.surgeryDate &&
    formData.quantity > 0 &&
    formData.quantity <= availableQuantity;

  const handleScan = () => {
    Taro.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        console.log('[Outbound] 扫码结果:', res);
        const barcode = res.result;
        const implant = availableImplants.find((i) => i.barcode === barcode);

        if (!implant) {
          setErrorMsg(`未找到条码为「${barcode}」的可用种植体，请确认是否已入库`);
          setSelectedImplant(null);
          Taro.vibrateShort({ type: 'heavy' });
          return;
        }

        const implantLatest = implants.find((i) => i.id === implant.id);
        if (implantLatest) {
          const available = implantLatest.quantity - implantLatest.usedQuantity - implantLatest.lockedQuantity;
          if (available <= 0) {
            setErrorMsg(`该批号「${implant.batchNo}」已无可用库存`);
            setSelectedImplant(null);
            Taro.vibrateShort({ type: 'heavy' });
            return;
          }
          setSelectedImplant(implantLatest);
        } else {
          setSelectedImplant(implant);
        }

        setErrorMsg('');
        setConfirmedUsage(null);
        Taro.vibrateShort({ type: 'light' });
        Taro.showToast({ title: '扫码成功', icon: 'success' });
      },
      fail: (err) => {
        console.error('[Outbound] 扫码失败:', err);
        Taro.showToast({ title: '扫码失败', icon: 'none' });
      }
    });
  };

  const handleInputChange = (field: keyof UsageForm, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    if (!selectedImplant || !isFormValid) return;

    const available = selectedImplant.quantity - selectedImplant.usedQuantity - selectedImplant.lockedQuantity;
    if (formData.quantity > available) {
      Taro.showToast({ title: '库存不足', icon: 'none' });
      return;
    }

    Taro.showModal({
      title: '确认领用',
      content: `确认领用 ${selectedImplant.brand} ${selectedImplant.spec} 共 ${formData.quantity} 支吗？`,
      success: (res) => {
        if (!res.confirm) return;

        const lockSuccess = lockImplant(selectedImplant.id, formData.quantity);
        if (!lockSuccess) {
          Taro.showToast({ title: '锁定失败，请重试', icon: 'none' });
          return;
        }

        const recordData = {
          implantId: selectedImplant.id,
          batchNo: selectedImplant.batchNo,
          brand: selectedImplant.brand,
          spec: selectedImplant.spec,
          doctor: DOCTORS[formData.doctorIndex],
          patientInitial: formData.patientInitial,
          patientId: formData.patientId,
          surgeryDate: formData.surgeryDate,
          quantity: formData.quantity,
          operator: '当前护士'
        };

        const usageSuccess = confirmUsage(recordData);
        if (!usageSuccess) {
          Taro.showToast({ title: '领用失败，请重试', icon: 'none' });
          return;
        }

        const newRecord: UsageRecord = {
          ...recordData,
          id: '',
          usedAt: dayjs().format('YYYY-MM-DD HH:mm')
        };

        setConfirmedUsage({
          implant: selectedImplant,
          record: newRecord
        });

        const updatedImplant = implants.find((i) => i.id === selectedImplant.id);
        if (updatedImplant) {
          setSelectedImplant(updatedImplant);
        }

        setFormData(initialForm);
        Taro.vibrateShort({ type: 'medium' });
        Taro.showToast({ title: '领用成功', icon: 'success' });
      }
    });
  };

  const getStockClass = (available: number, total: number) => {
    const ratio = available / total;
    if (ratio <= 0.2) return styles.stockLow;
    return styles.stockNormal;
  };

  const getExpiryClass = (expiryDate: string) => {
    const days = daysUntilExpiry(expiryDate);
    if (days < 0) return styles.expiryError;
    if (days < 180) return styles.expiryWarning;
    return '';
  };

  const handleRefresh = () => {
    Taro.stopPullDownRefresh();
    if (selectedImplant) {
      const latest = implants.find((i) => i.id === selectedImplant.id);
      if (latest) setSelectedImplant(latest);
    }
  };

  React.useEffect(() => {
    const unlisten = Taro.onPullDownRefresh(handleRefresh);
    return () => unlisten?.();
  }, [implants, selectedImplant]);

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>椅旁领用</Text>
        <Text className={styles.headerSubtitle}>手术前扫码领出种植体</Text>
      </View>

      <View className={styles.scanSection}>
        <Button className={styles.scanButton} onClick={handleScan}>
          <Text className={styles.scanIcon}>⌖</Text>
          <Text className={styles.scanText}>扫描种植体条码</Text>
        </Button>
      </View>

      {errorMsg && (
        <View className={styles.warningCard}>
          <Text className={styles.warningIcon}>!</Text>
          <Text>{errorMsg}</Text>
        </View>
      )}

      {selectedImplant && (
        <>
          <View className={styles.productCard}>
            <View className={styles.productHeader}>
              <View className={styles.productInfo}>
                <Text className={styles.productBrand}>{selectedImplant.brand}</Text>
                <Text className={styles.productSpec}>{selectedImplant.spec}</Text>
              </View>
            </View>

            <View className={styles.productTags}>
              <View className={styles.tag}>
                批号
                <Text className={styles.highlight}>{selectedImplant.batchNo}</Text>
              </View>
              <View className={classnames(styles.tag, getExpiryClass(selectedImplant.expiryDate))}>
                有效期
                <Text className={styles.highlight}>{selectedImplant.expiryDate}</Text>
              </View>
              <View className={styles.tag}>
                供应商
                <Text className={styles.highlight}>{selectedImplant.supplier}</Text>
              </View>
              <View className={classnames(styles.tag, getStockClass(availableQuantity, selectedImplant.quantity))}>
                可用库存
                <Text className={styles.highlight}>{availableQuantity} / {selectedImplant.quantity}</Text>
              </View>
            </View>
          </View>

          <View className={styles.formSection}>
            <Text className={styles.sectionTitle}>领用信息</Text>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>主治医生</Text>
              <Picker
                mode='selector'
                range={DOCTORS}
                value={formData.doctorIndex}
                onChange={(e) => handleInputChange('doctorIndex', Number(e.detail.value))}
              >
                <View className={styles.formInput}>
                  {DOCTORS[formData.doctorIndex]}
                </View>
              </Picker>
            </View>

            <View className={styles.formRow}>
              <View className={styles.formItem}>
                <Text className={styles.formLabel}>患者姓名首字</Text>
                <Input
                  className={styles.formInput}
                  placeholder='如: 张'
                  value={formData.patientInitial}
                  onInput={(e) => handleInputChange('patientInitial', e.detail.value)}
                  maxlength={1}
                />
                <Text className={styles.patientHint}>输入患者姓氏</Text>
              </View>

              <View className={styles.formItem}>
                <Text className={styles.formLabel}>病历号(选填)</Text>
                <Input
                  className={styles.formInput}
                  placeholder='病历号'
                  value={formData.patientId}
                  onInput={(e) => handleInputChange('patientId', e.detail.value)}
                />
              </View>
            </View>

            <View className={styles.formRow}>
              <View className={styles.formItem}>
                <Text className={styles.formLabel}>手术日期</Text>
                <Picker
                  mode='date'
                  value={formData.surgeryDate}
                  start={dayjs().format('YYYY-MM-DD')}
                  onChange={(e) => handleInputChange('surgeryDate', e.detail.value)}
                >
                  <View className={styles.formInput}>
                    {formData.surgeryDate}
                  </View>
                </Picker>
              </View>

              <View className={styles.formItem}>
                <Text className={styles.formLabel}>领用数量</Text>
                <Input
                  className={styles.formInput}
                  type='number'
                  placeholder='数量'
                  value={String(formData.quantity)}
                  onInput={(e) => handleInputChange('quantity', Number(e.detail.value) || 0)}
                />
              </View>
            </View>
          </View>
        </>
      )}

      {confirmedUsage && (
        <View className={styles.confirmCard}>
          <View className={styles.confirmHeader}>
            <View className={styles.confirmIcon}>✓</View>
            <Text className={styles.confirmTitle}>已锁定到该病例</Text>
          </View>
          <View className={styles.confirmDetail}>
            <View className={styles.confirmRow}>
              <Text className={styles.confirmLabel}>种植体</Text>
              <Text className={styles.confirmValue}>
                {confirmedUsage.implant.brand} {confirmedUsage.implant.spec}
              </Text>
            </View>
            <View className={styles.confirmRow}>
              <Text className={styles.confirmLabel}>批号</Text>
              <Text className={styles.confirmValue}>{confirmedUsage.record.batchNo}</Text>
            </View>
            <View className={styles.confirmRow}>
              <Text className={styles.confirmLabel}>医生</Text>
              <Text className={styles.confirmValue}>{confirmedUsage.record.doctor}</Text>
            </View>
            <View className={styles.confirmRow}>
              <Text className={styles.confirmLabel}>患者</Text>
              <Text className={styles.confirmValue}>
                {confirmedUsage.record.patientInitial}XX
                {confirmedUsage.record.patientId && ` (${confirmedUsage.record.patientId})`}
              </Text>
            </View>
            <View className={styles.confirmRow}>
              <Text className={styles.confirmLabel}>手术日期</Text>
              <Text className={styles.confirmValue}>{confirmedUsage.record.surgeryDate}</Text>
            </View>
            <View className={styles.confirmRow}>
              <Text className={styles.confirmLabel}>领用数量</Text>
              <Text className={styles.confirmValue}>{confirmedUsage.record.quantity} 支</Text>
            </View>
          </View>
        </View>
      )}

      <View className={styles.recordsSection}>
        <View className={styles.recordsHeader}>
          <Text className={styles.recordsTitle}>近期领用记录</Text>
          <Text className={styles.recordCount}>共 {recentRecords.length} 条</Text>
        </View>

        {recentRecords.length === 0 ? (
          <View className={styles.emptyState}>暂无领用记录</View>
        ) : (
          <View className={styles.recordList}>
            {recentRecords.map((record) => (
              <View key={record.id} className={styles.recordItem}>
                <View className={styles.recordHeader}>
                  <Text className={styles.recordProduct}>
                    {record.brand} {record.spec} × {record.quantity}
                  </Text>
                  <Text className={styles.recordBatch}>{record.batchNo}</Text>
                </View>
                <View className={styles.recordInfo}>
                  <View className={styles.recordTag}>
                    <Text className={styles.label}>医生:</Text>
                    <Text className={styles.value}>{record.doctor}</Text>
                  </View>
                  <View className={styles.recordTag}>
                    <Text className={styles.label}>患者:</Text>
                    <Text className={styles.value}>{record.patientInitial}XX</Text>
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

      <View className={styles.footerBar}>
        <Button
          className={classnames(styles.confirmButton, !isFormValid && styles.disabled)}
          onClick={handleConfirm}
          disabled={!isFormValid}
        >
          确认领用
        </Button>
      </View>
    </ScrollView>
  );
};

export default OutboundPage;
