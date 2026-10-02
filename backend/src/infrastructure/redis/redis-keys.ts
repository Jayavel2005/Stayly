/**
 * Centralized Redis Key Builder.
 * Standardizes key hierarchy according to:
 * `stayora:{environment}:{domain}:{identifier}`
 */
export class RedisKeys {
  private static getEnv(): string {
    return process.env.NODE_ENV || 'development';
  }

  /**
   * Generates cache key for individual hotel property details.
   * e.g., `stayora:development:hotel:550e8400-e29b-41d4-a716-446655440000`
   */
  static hotel(hotelId: string): string {
    return `stayora:${this.getEnv()}:hotel:${hotelId}`;
  }

  /**
   * Generates cache key for public hotel catalog search/list query hash.
   * e.g., `stayora:development:hotel-list:a1b2c3d4`
   */
  static hotelList(queryHash: string): string {
    return `stayora:${this.getEnv()}:hotel-list:${queryHash}`;
  }

  /**
   * Generates cache key for search results.
   * e.g., `stayora:development:search:f5e4d3c2`
   */
  static search(queryHash: string): string {
    return `stayora:${this.getEnv()}:search:${queryHash}`;
  }

  /**
   * Generates key for user transient data or rate limiting counters.
   * e.g., `stayora:development:user:550e8400-e29b-41d4-a716-446655440000`
   */
  static user(userId: string): string {
    return `stayora:${this.getEnv()}:user:${userId}`;
  }

  /**
   * Generates key for generic domain cache entry.
   * e.g., `stayora:development:temp:my-key`
   */
  static custom(domain: string, identifier: string): string {
    return `stayora:${this.getEnv()}:${domain}:${identifier}`;
  }

  /**
   * Generates pattern wildcard for cache invalidation.
   * e.g., `stayora:development:hotel:*`
   */
  static pattern(domain: string): string {
    return `stayora:${this.getEnv()}:${domain}:*`;
  }
}
