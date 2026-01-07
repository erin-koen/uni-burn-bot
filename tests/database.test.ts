import { TransactionDatabase } from '../src/database';
import { TokenTransfer } from '../src/types';
import * as fs from 'fs';

describe('TransactionDatabase', () => {
  let db: TransactionDatabase;
  const testDbPath = 'test-transactions.db';

  beforeEach(() => {
    // Use a test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new TransactionDatabase(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('transferExists', () => {
    it('should return false for non-existent transfer', () => {
      expect(db.transferExists('0x123')).toBe(false);
    });

    it('should return true for existing transfer', () => {
      const transfer: TokenTransfer = {
        hash: '0x123',
        blockNumber: 1000,
        tokenAddress: '0xtoken',
        from: '0xfrom',
        to: '0xto',
        value: BigInt('1000000000000000000'),
        timestamp: new Date(),
        burnerAddress: '0xburner',
      };
      db.addTransfer(transfer);
      expect(db.transferExists('0x123')).toBe(true);
    });
  });

  describe('addTransfer', () => {
    it('should add a transfer to the database', () => {
      const transfer: TokenTransfer = {
        hash: '0xabc',
        blockNumber: 2000,
        tokenAddress: '0xtoken',
        from: '0xfrom',
        to: '0xto',
        value: BigInt('2000000000000000000'),
        timestamp: new Date('2025-01-01T00:00:00Z'),
        burnerAddress: '0xburner',
      };

      db.addTransfer(transfer);
      expect(db.transferExists('0xabc')).toBe(true);
    });
  });

  describe('getTransferCount', () => {
    it('should return 0 for empty database', () => {
      expect(db.getTransferCount()).toBe(0);
    });

    it('should return correct count after adding transfers', () => {
      const transfer1: TokenTransfer = {
        hash: '0x1',
        blockNumber: 1000,
        tokenAddress: '0xtoken',
        from: '0xfrom1',
        to: '0xto',
        value: BigInt('1000000000000000000'),
        timestamp: new Date('2025-01-01T00:00:00Z'),
        burnerAddress: '0xburn1',
      };

      const transfer2: TokenTransfer = {
        hash: '0x2',
        blockNumber: 2000,
        tokenAddress: '0xtoken',
        from: '0xfrom2',
        to: '0xto',
        value: BigInt('2000000000000000000'),
        timestamp: new Date('2025-01-02T00:00:00Z'),
        burnerAddress: '0xburn2',
      };

      db.addTransfer(transfer1);
      db.addTransfer(transfer2);
      expect(db.getTransferCount()).toBe(2);
    });
  });

  describe('getTotalTokensSent', () => {
    it('should return 0 for empty database', () => {
      expect(db.getTotalTokensSent()).toBe(BigInt(0));
    });

    it('should sum all token values correctly', () => {
      const transfer1: TokenTransfer = {
        hash: '0x1',
        blockNumber: 1000,
        tokenAddress: '0xtoken',
        from: '0xfrom1',
        to: '0xto',
        value: BigInt('1000000000000000000'),
        timestamp: new Date('2025-01-01T00:00:00Z'),
        burnerAddress: '0xburn1',
      };

      const transfer2: TokenTransfer = {
        hash: '0x2',
        blockNumber: 2000,
        tokenAddress: '0xtoken',
        from: '0xfrom2',
        to: '0xto',
        value: BigInt('2000000000000000000'),
        timestamp: new Date('2025-01-02T00:00:00Z'),
        burnerAddress: '0xburn2',
      };

      db.addTransfer(transfer1);
      db.addTransfer(transfer2);
      expect(db.getTotalTokensSent()).toBe(BigInt('3000000000000000000'));
    });
  });

  describe('getTopBurners', () => {
    it('should return empty array for empty database', () => {
      expect(db.getTopBurners(3)).toEqual([]);
    });

    it('should return top burners by transaction count', () => {
      // Add transfers from different burners
      const burner1 = '0xburn1';
      const burner2 = '0xburn2';
      const burner3 = '0xburn3';

      // Burner1: 3 transactions
      for (let i = 0; i < 3; i++) {
        db.addTransfer({
          hash: `0x1${i}`,
          blockNumber: 1000 + i,
          tokenAddress: '0xtoken',
          from: '0xfrom',
          to: '0xto',
          value: BigInt('1000000000000000000'),
          timestamp: new Date(`2025-01-0${i + 1}T00:00:00Z`),
          burnerAddress: burner1,
        });
      }

      // Burner2: 2 transactions
      for (let i = 0; i < 2; i++) {
        db.addTransfer({
          hash: `0x2${i}`,
          blockNumber: 2000 + i,
          tokenAddress: '0xtoken',
          from: '0xfrom',
          to: '0xto',
          value: BigInt('1000000000000000000'),
          timestamp: new Date(`2025-01-0${i + 4}T00:00:00Z`),
          burnerAddress: burner2,
        });
      }

      // Burner3: 1 transaction
      db.addTransfer({
        hash: '0x30',
        blockNumber: 3000,
        tokenAddress: '0xtoken',
        from: '0xfrom',
        to: '0xto',
        value: BigInt('1000000000000000000'),
        timestamp: new Date('2025-01-06T00:00:00Z'),
        burnerAddress: burner3,
      });

      const topBurners = db.getTopBurners(3);
      expect(topBurners).toHaveLength(3);
      expect(topBurners[0].address).toBe(burner1);
      expect(topBurners[0].count).toBe(3);
      expect(topBurners[1].address).toBe(burner2);
      expect(topBurners[1].count).toBe(2);
      expect(topBurners[2].address).toBe(burner3);
      expect(topBurners[2].count).toBe(1);
    });
  });

  describe('getBurnerStats', () => {
    it('should return correct count and rank', () => {
      const burner1 = '0xburn1';
      const burner2 = '0xburn2';

      // Add 3 transactions from burner1
      for (let i = 0; i < 3; i++) {
        db.addTransfer({
          hash: `0x1${i}`,
          blockNumber: 1000 + i,
          tokenAddress: '0xtoken',
          from: '0xfrom',
          to: '0xto',
          value: BigInt('1000000000000000000'),
          timestamp: new Date(`2025-01-0${i + 1}T00:00:00Z`),
          burnerAddress: burner1,
        });
      }

      // Add 1 transaction from burner2
      db.addTransfer({
        hash: '0x20',
        blockNumber: 2000,
        tokenAddress: '0xtoken',
        from: '0xfrom',
        to: '0xto',
        value: BigInt('1000000000000000000'),
        timestamp: new Date('2025-01-04T00:00:00Z'),
        burnerAddress: burner2,
      });

      const stats1 = db.getBurnerStats(burner1);
      expect(stats1.count).toBe(3);
      expect(stats1.rank).toBe(1);
      expect(stats1.totalBurners).toBe(2);

      const stats2 = db.getBurnerStats(burner2);
      expect(stats2.count).toBe(1);
      expect(stats2.rank).toBe(2);
      expect(stats2.totalBurners).toBe(2);
    });
  });

  describe('getAverageTimeBetweenTransfers', () => {
    it('should return null for less than 2 transfers', () => {
      expect(db.getAverageTimeBetweenTransfers()).toBeNull();

      db.addTransfer({
        hash: '0x1',
        blockNumber: 1000,
        tokenAddress: '0xtoken',
        from: '0xfrom',
        to: '0xto',
        value: BigInt('1000000000000000000'),
        timestamp: new Date('2025-01-01T00:00:00Z'),
        burnerAddress: '0xburn',
      });

      expect(db.getAverageTimeBetweenTransfers()).toBeNull();
    });

    it('should calculate average time correctly', () => {
      const date1 = new Date('2025-01-01T00:00:00Z');
      const date2 = new Date('2025-01-02T00:00:00Z'); // 24 hours later
      const date3 = new Date('2025-01-04T00:00:00Z'); // 48 hours later

      db.addTransfer({
        hash: '0x1',
        blockNumber: 1000,
        tokenAddress: '0xtoken',
        from: '0xfrom',
        to: '0xto',
        value: BigInt('1000000000000000000'),
        timestamp: date1,
        burnerAddress: '0xburn',
      });

      db.addTransfer({
        hash: '0x2',
        blockNumber: 2000,
        tokenAddress: '0xtoken',
        from: '0xfrom',
        to: '0xto',
        value: BigInt('1000000000000000000'),
        timestamp: date2,
        burnerAddress: '0xburn',
      });

      db.addTransfer({
        hash: '0x3',
        blockNumber: 3000,
        tokenAddress: '0xtoken',
        from: '0xfrom',
        to: '0xto',
        value: BigInt('1000000000000000000'),
        timestamp: date3,
        burnerAddress: '0xburn',
      });

      const average = db.getAverageTimeBetweenTransfers();
      expect(average).not.toBeNull();
      // Average of 24h and 48h = 36h = 129600000 ms
      expect(average).toBe(129600000);
    });
  });
});

