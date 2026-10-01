export interface AppConfig {
  env: string;
  port: number;
  database: {
    url: string;
  };
  jwt: {
    secret?: string;
    expiresIn: string;
  };
  redis: {
    host: string;
    port: number;
  };
  cors: {
    origins: string[];
  };
}

export default (): AppConfig => {
  const corsOriginsRaw =
    process.env.CORS_ORIGINS ||
    'http://localhost:3000,http://localhost:3001,http://localhost:3002';

  const origins = corsOriginsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    database: {
      url: process.env.DATABASE_URL || '',
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    cors: {
      origins,
    },
  };
};
