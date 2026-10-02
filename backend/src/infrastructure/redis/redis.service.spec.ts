import { RedisService } from './redis.service';
import { REDIS_TTL } from './redis.constants';
import type { Redis } from 'ioredis';

describe('RedisService Unit Tests', () => {
  let service: RedisService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      incrby: jest.fn(),
      decrby: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
      status: 'ready',
    };

    service = new RedisService(mockClient as unknown as Redis);
  });

  describe('get', () => {
    it('should return parsed JSON object on cache hit', async () => {
      const data = { id: '123', name: 'Grand Resort' };
      mockClient.get.mockResolvedValue(JSON.stringify(data));

      const result = await service.get<typeof data>('test-key');
      expect(result).toEqual(data);
      expect(mockClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null on cache miss (nil key)', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await service.get('missing-key');
      expect(result).toBeNull();
    });

    it('should safely evict corrupt JSON entries and return null without throwing', async () => {
      mockClient.get.mockResolvedValue('invalid-json{{{');
      mockClient.del.mockResolvedValue(1);

      const result = await service.get('corrupted-key');
      expect(result).toBeNull();
      expect(mockClient.del).toHaveBeenCalledWith('corrupted-key');
    });

    it('should return null gracefully when Redis client throws connection error', async () => {
      mockClient.get.mockRejectedValue(new Error('Connection lost'));

      const result = await service.get('any-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should serialize object and set with custom TTL', async () => {
      const value = { title: 'Suite Room' };
      mockClient.set.mockResolvedValue('OK');

      await service.set('room-1', value, 120);
      expect(mockClient.set).toHaveBeenCalledWith(
        'room-1',
        JSON.stringify(value),
        'EX',
        120,
      );
    });

    it('should serialize object and use default MEDIUM TTL if omitted', async () => {
      const value = { title: 'Standard Room' };
      mockClient.set.mockResolvedValue('OK');

      await service.set('room-2', value);
      expect(mockClient.set).toHaveBeenCalledWith(
        'room-2',
        JSON.stringify(value),
        'EX',
        REDIS_TTL.MEDIUM,
      );
    });

    it('should set without TTL if ttlSeconds is 0', async () => {
      mockClient.set.mockResolvedValue('OK');

      await service.set('eternal-key', 'data', 0);
      expect(mockClient.set).toHaveBeenCalledWith('eternal-key', JSON.stringify('data'));
    });

    it('should handle Redis SET errors gracefully without throwing', async () => {
      mockClient.set.mockRejectedValue(new Error('OOM command not allowed'));

      await expect(service.set('key', { val: 1 })).resolves.not.toThrow();
    });
  });

  describe('delete', () => {
    it('should call del with key', async () => {
      mockClient.del.mockResolvedValue(1);

      await service.delete('del-key');
      expect(mockClient.del).toHaveBeenCalledWith('del-key');
    });

    it('should swallow deletion errors gracefully', async () => {
      mockClient.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.delete('del-key')).resolves.not.toThrow();
    });
  });

  describe('deleteByPattern', () => {
    it('should scan and delete matching keys in batches until cursor is 0', async () => {
      mockClient.scan
        .mockResolvedValueOnce(['42', ['key:1', 'key:2']])
        .mockResolvedValueOnce(['0', ['key:3']]);
      mockClient.del.mockResolvedValue(1);

      await service.deleteByPattern('key:*');

      expect(mockClient.scan).toHaveBeenCalledTimes(2);
      expect(mockClient.del).toHaveBeenCalledWith('key:1', 'key:2');
      expect(mockClient.del).toHaveBeenCalledWith('key:3');
    });

    it('should handle scan without deleting if no keys matched', async () => {
      mockClient.scan.mockResolvedValueOnce(['0', []]);

      await service.deleteByPattern('nomatch:*');

      expect(mockClient.scan).toHaveBeenCalledTimes(1);
      expect(mockClient.del).not.toHaveBeenCalled();
    });

    it('should handle deleteByPattern error gracefully', async () => {
      mockClient.scan.mockRejectedValue(new Error('Scan error'));

      await expect(service.deleteByPattern('error:*')).resolves.not.toThrow();
    });
  });

  describe('exists & expire', () => {
    it('should return true if exists returns > 0', async () => {
      mockClient.exists.mockResolvedValue(1);
      const res = await service.exists('test-exists');
      expect(res).toBe(true);
    });

    it('should return false if exists returns 0 or throws', async () => {
      mockClient.exists.mockResolvedValue(0);
      expect(await service.exists('not-found')).toBe(false);

      mockClient.exists.mockRejectedValue(new Error('Timeout'));
      expect(await service.exists('err-key')).toBe(false);
    });

    it('should call expire with key and ttlSeconds', async () => {
      mockClient.expire.mockResolvedValue(1);
      await service.expire('key', 60);
      expect(mockClient.expire).toHaveBeenCalledWith('key', 60);
    });
  });

  describe('increment & decrement', () => {
    it('should increment key by given amount', async () => {
      mockClient.incrby.mockResolvedValue(5);
      const res = await service.increment('counter', 2);
      expect(res).toBe(5);
      expect(mockClient.incrby).toHaveBeenCalledWith('counter', 2);
    });

    it('should decrement key by given amount', async () => {
      mockClient.decrby.mockResolvedValue(3);
      const res = await service.decrement('counter', 2);
      expect(res).toBe(3);
      expect(mockClient.decrby).toHaveBeenCalledWith('counter', 2);
    });
  });

  describe('ping & isHealthy', () => {
    it('should ping Redis successfully', async () => {
      mockClient.ping.mockResolvedValue('PONG');
      const res = await service.ping();
      expect(res).toBe('PONG');
    });

    it('should return true for isHealthy when ping responds with PONG', async () => {
      mockClient.ping.mockResolvedValue('PONG');
      expect(await service.isHealthy()).toBe(true);
    });

    it('should return false for isHealthy when ping throws or fails', async () => {
      mockClient.ping.mockRejectedValue(new Error('ECONNREFUSED'));
      expect(await service.isHealthy()).toBe(false);
    });
  });

  describe('wrap (Cache-Aside Pattern)', () => {
    it('should return cached value immediately on cache hit without calling loader', async () => {
      const cachedData = { id: 'hotel-1', name: 'Cached Palace' };
      mockClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const loader = jest.fn();

      const result = await service.wrap('hotel:1', loader, 300);

      expect(result).toEqual(cachedData);
      expect(loader).not.toHaveBeenCalled();
      expect(mockClient.set).not.toHaveBeenCalled();
    });

    it('should execute loader, cache result, and return data on cache miss', async () => {
      mockClient.get.mockResolvedValue(null);
      mockClient.set.mockResolvedValue('OK');

      const dbData = { id: 'hotel-2', name: 'Fresh Palace' };
      const loader = jest.fn().mockResolvedValue(dbData);

      const result = await service.wrap('hotel:2', loader, 300);

      expect(result).toEqual(dbData);
      expect(loader).toHaveBeenCalledTimes(1);
      expect(mockClient.set).toHaveBeenCalledWith(
        'hotel:2',
        JSON.stringify(dbData),
        'EX',
        300,
      );
    });

    it('should fallback gracefully to database loader when Redis GET throws', async () => {
      mockClient.get.mockRejectedValue(new Error('Redis connection down'));
      mockClient.set.mockRejectedValue(new Error('Redis write failed'));

      const dbData = { id: 'hotel-3', name: 'Resilient Hotel' };
      const loader = jest.fn().mockResolvedValue(dbData);

      const result = await service.wrap('hotel:3', loader, 300);

      expect(result).toEqual(dbData);
      expect(loader).toHaveBeenCalledTimes(1);
    });
  });

  describe('onApplicationShutdown', () => {
    it('should quit Redis client on application shutdown if ready', async () => {
      mockClient.status = 'ready';
      mockClient.quit.mockResolvedValue('OK');

      await service.onApplicationShutdown('SIGTERM');
      expect(mockClient.quit).toHaveBeenCalled();
    });

    it('should not throw if quit errors during shutdown', async () => {
      mockClient.status = 'ready';
      mockClient.quit.mockRejectedValue(new Error('Socket closed'));

      await expect(service.onApplicationShutdown('SIGTERM')).resolves.not.toThrow();
    });
  });
});
