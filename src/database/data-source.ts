import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { CustomTypeORMLogger } from './logger';

dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'routine_user',
  password: process.env.DB_PASSWORD || 'routine_pass',
  database: process.env.DB_NAME || 'routine_db',
  entities: [__dirname + '/../entities/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  synchronize: false,
  logger: new CustomTypeORMLogger(),
  logging: true,
  // Supabase uses PgBouncer — keep pool small to stay within connection limits
  extra: {
    max: 8,
    min: 1,
    idleTimeoutMillis: 20000,      // must be less than PgBouncer's server_idle_timeout (default 30s)
    connectionTimeoutMillis: 10000,
    // TCP keepalives prevent the OS from silently dropping idle connections
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Supabase requires SSL
    ssl: { rejectUnauthorized: false },
    // Force UTC on every new connection — prevents timezone mismatch for TIMESTAMP columns
    options: '-c timezone=UTC',
    application_name: 'baust_routine_orchestrator',
  },
};

const dataSource = new DataSource(dataSourceOptions);

dataSource.initialize()
  .catch((err) => {
    console.error('❌ Error during Data Source initialization', err);
  });

export default dataSource;
