import React, { useState, useMemo } from 'react';
import { View, Text, Input, Button, ScrollView, Picker, Swiper, SwiperItem } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { useImplantStore } from '@/store/implantStore';
import { daysUntilExpiry } from '@/utils/validator';
import type { ImplantInfo, LockRecord } from '@/types/implant';
import { DOCTORS } from '@/types/implant';

type TabType = 'lock' | 'confirm';

interface LockForm {
  doctorIndex: number;
  patientInitial: string;
  patientId: string;
  surgeryDate: string;
  quantity: number;
}

interface LockedSuccess {
  record: LockRecord;
  implant: ImplantInfo;
}

const initialForm: LockForm = {
  doctorIndex: 0,
  patientInitial: '',
  patientId: '',
  surgeryDate: dayjs().format('YYYY-MM-DD'),
  quantity: 1
};

const OutboundPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('lock');
  const [selectedImplant, setSelectedImplant] = useState<ImplantInfo | null>(null);
  const [formData, setFormData] = useState<LockForm>(initialForm);
  const [lockedSuccess, setLockedSuccess] = useState<LockedSuccess | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const {
    implants,
    usageRecords,
    createLockRecord,
    confirmLockUsage,
    cancelLockRecord,
    getActiveLockRecords,
    getAvailableImplants,
    getLockRecordsByImplant
  } = useImplantStore();

  const availableImplants = useMemo(() => getAvailableImplants(), [getAvailableImplants]);
  const activeLockRecords = useMemo(() => getActiveLockRecords(), [getActiveLockRecords, implants]);

  const recentRecords = useMemo(() => {
    return [...usageRecords]
      .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
      .slice(0, 10);
  }, [usageRecords]);

  const availableQuantity = useMemo(() => {
    if (!selectedImplant) return 0;
    const latest = implants.find((i) => i.id === selectedImplant.id);
    if (!latest) return 0;
    return latest.quantity - latest.usedQuantity - latest.lockedQuantity;
  }, [selectedImplant, implants]);

  const isLockFormValid = selectedImplant &&
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
        setLockedSuccess(null);
        Taro.vibrateShort({ type: 'light' });
        Taro.showToast({ title: '扫码成功', icon: 'success' });
      },
      fail: (err) => {
        console.error('[Outbound] 扫码失败:', err);
        Taro.showToast({ title: '扫码失败', icon: 'none' });
      }
    });
  };

  const handleInputChange = (field: keyof LockForm, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateLock = () => {
    if (!selectedImplant || !isLockFormValid) return;

    Taro.showModal({
      title: '确认术前锁定',
      content: `确认锁定 ${selectedImplant.brand} ${selectedImplant.spec} 共 ${formData.quantity} 支吗？锁定后该库存将被保留。`,
      success: (res) => {
        if (!res.confirm) return;

        const lockRecord = createLockRecord({
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
        });

        if (lockRecord) {
          const updatedImplant = implants.find((i) => i.id === selectedImplant.id);
          if (updatedImplant) {
            setSelectedImplant(updatedImplant);
          }
          setLockedSuccess({
            record: lockRecord,
            implant: selectedImplant
          });
          setFormData(initialForm);
          Taro.vibrateShort({ type: 'medium' });
          Taro.showToast({ title: '锁定成功', icon: 'success' });
        } else {
          Taro.showToast({ title: '锁定失败，请重试', icon: 'none' });
        }
      }
    });
  };

  const handleConfirmUsage = (lockRecord: LockRecord) => {
    Taro.showModal({
      title: '确认使用',
      content: `确认将 ${lockRecord.brand} ${lockRecord.spec} × ${lockRecord.quantity} 转为已使用吗？此操作不可撤销。`,
      success: (res) => {
        if (!res.confirm) return;

        const success = confirmLockUsage(lockRecord.id);
        if (success) {
          if (selectedImplant && selectedImplant.id === lockRecord.implantId) {
            const updatedImplant = implants.find((i) => i.id === lockRecord.implantId);
            if (updatedImplant) {
              setSelectedImplant(updatedImplant);
            }
          }
          Taro.showToast({ title: '已确认使用', icon: 'success' });
        } else {
          Taro.showToast({ title: '操作失败，请重试', icon: 'none' });
        }
      }
    });
  };

  const handleCancelLock = (lockRecord: LockRecord) => {
    Taro.showModal({
      title: '取消锁定',
      content: `确定取消 ${lockRecord.brand} ${lockRecord.spec} × ${lockRecord.quantity} 的锁定吗？库存将被释放。`,
      success: (res) => {
        if (!res.confirm) return;

        const success = cancelLockRecord(lockRecord.id);
        if (success) {
          if (selectedImplant && selectedImplant.id === lockRecord.implantId) {
            const updatedImplant = implants.find((i) => i.id === lockRecord.implantId);
            if (updatedImplant) {
              setSelectedImplant(updatedImplant);
            }
          }
          Taro.showToast({ title: '已取消锁定', icon: 'success' });
        } else {
          Taro.showToast({ title: '操作失败，请重试', icon: 'none' });
        }
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
        <Text className={styles.headerSubtitle}>术前锁定库存，术后确认使用</Text>
      </View>

      <View className={styles.tabs}>
        <View
          className={classnames(styles.tab, activeTab === 'lock' && styles.activeTab)}
          onClick={() => setActiveTab('lock')}
        >
          <Text className={styles.tabText}>术前锁定</Text>
          {activeLockRecords.length > 0 && (
            <View className={styles.tabBadge}>{activeLockRecords.length}</View>
          )}
        </View>
        <View
          className={classnames(styles.tab, activeTab === 'confirm' && styles.activeTab)}
          onClick={() => setActiveTab('confirm')}
        >
          <Text className={styles.tabText}>术后确认</Text>
        </View>
        <View className={styles.tabIndicator} style={{ left: activeTab === 'lock' ? '0%' : '50%' }} />
      </View>

      {activeTab === 'lock' && (
        <>
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
                <Text className={styles.sectionTitle}>锁定信息</Text>

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
                    <Text className={styles.formLabel}>锁定数量</Text>
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

          {lockedSuccess && (
            <View className={styles.confirmCard}>
              <View className={styles.confirmHeader}>
                <View className={styles.confirmIcon}>✓</View>
                <Text className={styles.confirmTitle}>已锁定到该病例</Text>
              </View>
              <View className={styles.confirmDetail}>
                <View className={styles.confirmRow}>
                  <Text className={styles.confirmLabel}>种植体</Text>
                  <Text className={styles.confirmValue}>
                    {lockedSuccess.implant.brand} {lockedSuccess.implant.spec}
                  </Text>
                </View>
                <View className={styles.confirmRow}>
                  <Text className={styles.confirmLabel}>批号</Text>
                  <Text className={styles.confirmValue}>{lockedSuccess.record.batchNo}</Text>
                </View>
                <View className={styles.confirmRow}>
                  <Text className={styles.confirmLabel}>医生</Text>
                  <Text className={styles.confirmValue}>{lockedSuccess.record.doctor}</Text>
                </View>
                <View className={styles.confirmRow}>
                  <Text className={styles.confirmLabel}>患者</Text>
                  <Text className={styles.confirmValue}>
                    {lockedSuccess.record.patientInitial}XX
                    {lockedSuccess.record.patientId && ` (${lockedSuccess.record.patientId})`}
                  </Text>
                </View>
                <View className={styles.confirmRow}>
                  <Text className={styles.confirmLabel}>手术日期</Text>
                  <Text className={styles.confirmValue}>{lockedSuccess.record.surgeryDate}</Text>
                </View>
                <View className={styles.confirmRow}>
                  <Text className={styles.confirmLabel}>锁定数量</Text>
                  <Text className={styles.confirmValue}>{lockedSuccess.record.quantity} 支</Text>
                </View>
                <View className={styles.confirmRow}>
                  <Text className={styles.confirmLabel}>锁定时间</Text>
                  <Text className={styles.confirmValue}>{lockedSuccess.record.lockedAt}</Text>
                </View>
              </View>
            </View>
          )}

          {selectedImplant && (
            <View className={styles.footerBar}>
              <Button
                className={classnames(styles.confirmButton, !isLockFormValid && styles.disabled)}
                onClick={handleCreateLock}
                disabled={!isLockFormValid}
              >
                术前锁定
              </Button>
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
                        <View className={classnames(styles.tag, getStockClass(
                          implant.quantity - implant.usedQuantity - implant.lockedQuantity,
                          implant.quantity
                        ))}>
                          可用
                          <Text className={styles.highlight}>
                            {implant.quantity - implant.usedQuantity - implant.lockedQuantity}
                          </Text>
                        </View>
                      </View>
                    )}

                    <View className={styles.lockActions}>
                      <Button
                        className={classnames(styles.actionBtn, styles.cancelBtn)}
                        onClick={() => handleCancelLock(record)}
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

      {activeTab === 'lock' && selectedImplant && (
        <View style={{ height: 120 }} />
      )}

      <View className={styles.recordsSection}>
        <View className={styles.recordsHeader}>
          <Text className={styles.recordsTitle}>近期使用记录</Text>
          <Text className={styles.recordCount}>共 {recentRecords.length} 条</Text>
        </View>

        {recentRecords.length === 0 ? (
          <View className={styles.emptyState}>暂无使用记录</View>
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
                <Text className={styles.recordTime}>使用时间: {record.usedAt}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default OutboundPage;
