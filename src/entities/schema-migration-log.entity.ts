import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('schema_migration_logs')
export class SchemaMigrationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  semester_id: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  schema_name: string | null;

  @Column({ type: 'varchar', length: 50 })
  operation: string;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'varchar', length: 20, default: 'INFO' })
  level: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  error_details: string | null;

  @Column({ type: 'integer', nullable: true })
  duration_ms: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
