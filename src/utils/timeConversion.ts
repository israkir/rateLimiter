import { TTL_UNIT_TYPE } from '../types';

export const convertToMs = (value: number, unit: TTL_UNIT_TYPE): number => {
  switch (unit) {
    case 'min':
      return value * 60000;
    case 'hour':
      return value * 3600000;
    default:
      return 3600000; // 1 hour
  }
};
