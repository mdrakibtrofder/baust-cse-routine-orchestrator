import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

/** Single-row table of global app-wide toggles (not semester-scoped). */
@Entity('app_settings')
export class AppSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Whether routine views/exports render a BREAK column for periods marked is_break. */
  @Column({ type: 'boolean', default: true })
  show_break_column: boolean;

  @Column({ type: 'boolean', default: false })
  maintenance_mode: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  maintenance_operation: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  maintenance_message: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  maintenance_started_at: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
