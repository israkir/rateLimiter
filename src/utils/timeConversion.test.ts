import { convertToMs } from '.';

describe('Time Utility Functions', () => {
  describe('convertToMs', () => {
    it('should convert minutes to milliseconds', () => {
      expect(convertToMs(5, 'min')).toBe(300000);
      expect(convertToMs(1, 'min')).toBe(60000);
      expect(convertToMs(0, 'min')).toBe(0);
    });

    it('should convert hours to milliseconds', () => {
      expect(convertToMs(1, 'hour')).toBe(3600000);
      expect(convertToMs(2, 'hour')).toBe(7200000);
      expect(convertToMs(0, 'hour')).toBe(0);
    });

    it('should return default value for invalid unit', () => {
      expect(convertToMs(5, 'invalid' as any)).toBe(3600000);
    });
  });
});
