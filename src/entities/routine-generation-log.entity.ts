import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('routine_generation_logs')
export class RoutineGenerationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  run_id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'varchar', length: 20, default: 'INFO' })
  level: string;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
