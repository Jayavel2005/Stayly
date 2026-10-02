import { RedisKeys } from './redis-keys';

describe('RedisKeys Builder', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should generate properly namespaced hotel cache key', () => {
    process.env.NODE_ENV = 'test';
    const key = RedisKeys.hotel('hotel-123');
    expect(key).toBe('stayora:test:hotel:hotel-123');
  });

  it('should ensure key isolation between different hotels', () => {
    process.env.NODE_ENV = 'production';
    const keyHotelA = RedisKeys.hotel('hotel-aaa');
    const keyHotelB = RedisKeys.hotel('hotel-bbb');

    expect(keyHotelA).toBe('stayora:production:hotel:hotel-aaa');
    expect(keyHotelB).toBe('stayora:production:hotel:hotel-bbb');
    expect(keyHotelA).not.toBe(keyHotelB);
  });

  it('should generate hotel list key from query hash', () => {
    process.env.NODE_ENV = 'test';
    const key = RedisKeys.hotelList('hash-abc');
    expect(key).toBe('stayora:test:hotel-list:hash-abc');
  });

  it('should generate search cache key', () => {
    process.env.NODE_ENV = 'test';
    const key = RedisKeys.search('hash-xyz');
    expect(key).toBe('stayora:test:search:hash-xyz');
  });

  it('should generate user cache key', () => {
    process.env.NODE_ENV = 'test';
    const key = RedisKeys.user('user-456');
    expect(key).toBe('stayora:test:user:user-456');
  });

  it('should generate custom domain key', () => {
    process.env.NODE_ENV = 'staging';
    const key = RedisKeys.custom('temp', 'session-123');
    expect(key).toBe('stayora:staging:temp:session-123');
  });

  it('should generate pattern for cache invalidation', () => {
    process.env.NODE_ENV = 'test';
    const pattern = RedisKeys.pattern('hotel');
    expect(pattern).toBe('stayora:test:hotel:*');
  });

  it('should fallback to development environment when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    const key = RedisKeys.hotel('hotel-999');
    expect(key).toBe('stayora:development:hotel:hotel-999');
  });
});
