import dayjs from 'dayjs';
import type { ValidationWarning } from '@/types/implant';

export const validateBatchNo = (batchNo: string, existingBatchNos: string[]): ValidationWarning | null => {
  if (existingBatchNos.includes(batchNo)) {
    return {
      type: 'batch_duplicate',
      message: `该批号「${batchNo}」已存在，请核对规格、供应商是否一致`,
      level: 'warning'
    };
  }
  return null;
};

export const validateExpiryDate = (expiryDate: string): ValidationWarning | null => {
  if (!expiryDate) return null;
  
  const expiry = dayjs(expiryDate);
  const now = dayjs();
  const daysDiff = expiry.diff(now, 'day');
  
  if (daysDiff < 0) {
    return {
      type: 'expiry_expired',
      message: `该产品已过期 ${Math.abs(daysDiff)} 天`,
      level: 'error'
    };
  }
  
  if (daysDiff < 180) {
    return {
      type: 'expiry_near',
      message: `有效期不足 ${daysDiff} 天，请优先使用`,
      level: 'warning'
    };
  }
  
  return null;
};

export const validateImplantForm = (
  formData: { batchNo: string; expiryDate: string },
  existingBatchNos: string[]
): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];
  
  const batchWarning = validateBatchNo(formData.batchNo, existingBatchNos);
  if (batchWarning) warnings.push(batchWarning);
  
  const expiryWarning = validateExpiryDate(formData.expiryDate);
  if (expiryWarning) warnings.push(expiryWarning);
  
  return warnings;
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const formatDate = (date: string): string => {
  return dayjs(date).format('YYYY-MM-DD');
};

export const daysUntilExpiry = (expiryDate: string): number => {
  return dayjs(expiryDate).diff(dayjs(), 'day');
};
