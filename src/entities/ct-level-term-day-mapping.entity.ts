import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Department } from './department.entity';

/**
 * Which weekday(s) a level-term (e.g. "Level 1 Term I") tests on, every week,
 * for the purposes of CT (class test) generation — independent of the
 * semester-wide holiday/blackout calendar in `CTWeekConfig`. One row per
 * level+term+departmental_type+department bucket.
 */
@Entity('ct_level_term_day_mappings')
@Index(['semester_id', 'level', 'term', 'departmental_type', 'department_id'], { unique: true })
export class CTLevelTermDayMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'integer' })
  level: number;

  @Column({ type: 'varchar', length: 10, enum: ['I', 'II'] })
  term: 'I' | 'II';

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['Departmental', 'Non-Departmental'],
    default: 'Departmental',
  })
  departmental_type: 'Departmental' | 'Non-Departmental';

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  /** Weekday codes, e.g. ['SUN', 'WED'] — matches the `days.name` convention
   *  used elsewhere in the app (class slots, periods, etc.). */
  @Column({ type: 'varchar', array: true, default: () => "array[]::varchar[]" })
  days: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Semester, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;
}
