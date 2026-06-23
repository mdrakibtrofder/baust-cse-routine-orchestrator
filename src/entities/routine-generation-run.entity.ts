import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('routine_generation_runs')
export class RoutineGenerationRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'varchar', length: 200 })
  semester_name: string;

  @Column({ type: 'varchar', length: 20, default: 'RUNNING' })
  status: string;

  @Column({ type: 'integer', default: 0 })
  total_slots: number;

  @Column({ type: 'integer', default: 0 })
  generated_slots: number;

  @Column({ type: 'integer', default: 0 })
  failed_slots: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  success_rate: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  ended_at: Date | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
