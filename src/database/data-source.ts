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
  logging: process.env.NODE_ENV !== 'production' ? ['error', 'warn', 'schema', 'migration'] : ['error'],
  extra: {
    max: 20, // max number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
};

const dataSource = new DataSource(dataSourceOptions);

dataSource.initialize()
  .then(() => {
    // Suppress initialization log as NestJS will log it
  })
  .catch((err) => {
    console.error("❌ Error during Data Source initialization", err);
  });

export default dataSource;
