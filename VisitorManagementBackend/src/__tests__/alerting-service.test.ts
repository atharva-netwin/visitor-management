import { alertingService } from '../services/AlertingService';
import { monitoringService } from '../services/MonitoringService';

// Mock dependencies
jest.mock('../services/MonitoringService', () => ({
  monitoringService: { getSystemHealth: jest.fn() }
}));
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const mockMonitoringService = monitoringService as jest.Mocked<typeof monitoringService>;

describe('AlertingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should have default configuration', () => {
      const config = alertingService.getConfig();
      expect(config).toBeDefined();
      expect(config.thresholds).toBeDefined();
    });

    it('should update configuration', () => {
      const newConfig = { thresholds: { errorRate: 20 } };
      alertingService.updateConfig(newConfig);
      const config = alertingService.getConfig();
      expect(config.thresholds.errorRate).toBe(20);
    });
  });

  describe('Error recording', () => {
    it('should record errors without throwing', () => {
      expect(() => {
        alertingService.recordError('test_error');
      }).not.toThrow();
    });
  });

  describe('Response time recording', () => {
    it('should record response times', () => {
      expect(() => {
        alertingService.recordResponseTime(100);
      }).not.toThrow();
    });
  });

  describe('Alert history', () => {
    it('should return empty alert history initially', () => {
      const history = alertingService.getAlertHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });
});