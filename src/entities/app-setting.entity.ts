import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

/** Single-row table of global app-wide toggles (not semester-scoped). */
@Entity('app_settings')
export class AppSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Whether routine views/exports render a BREAK column for periods marked is_break. */
  @Column({ type: 'boolean', default: true })
  show_break_column: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
