import { validateEnvironment } from './env.validation';

describe('Environment Validation', () => {
  const validConfig = {
    NODE_ENV: 'test',
    PORT: 4000,
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test_db',
  };

  it('should successfully validate and return config with valid variables', () => {
    const result = validateEnvironment(validConfig);
    expect(result).toBeDefined();
    expect(result.PORT).toBe(4000);
    expect(result.NODE_ENV).toBe('test');
    expect(result.DATABASE_URL).toBe(
      'postgresql://postgres:postgres@localhost:5432/test_db',
    );
  });

  it('should fail when DATABASE_URL is missing', () => {
    const invalidConfig = {
      NODE_ENV: 'development',
      PORT: 4000,
    };

    expect(() => validateEnvironment(invalidConfig)).toThrow(
      /Critical Environment Configuration Error/,
    );
  });

  it('should fail when PORT is outside valid range', () => {
    const invalidConfig = {
      ...validConfig,
      PORT: 99999,
    };

    expect(() => validateEnvironment(invalidConfig)).toThrow(
      /PORT must not exceed 65535/,
    );
  });

  it('should fail when NODE_ENV is invalid', () => {
    const invalidConfig = {
      ...validConfig,
      NODE_ENV: 'staging-invalid',
    };

    expect(() => validateEnvironment(invalidConfig)).toThrow(
      /NODE_ENV must be either development, production, or test/,
    );
  });
});
