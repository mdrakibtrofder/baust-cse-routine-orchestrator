import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';

/** One class test as it stood before the first reschedule was applied — the
 *  scheduling fields only, plus the id needed to put it back. */
export interface CTSnapshotAssignment {
  id: string;
  course_id: string;
  room_ids: string[];
  week_number: number;
  date: string;
  ct_number: number;
}

/** Keeps the CT schedule exactly as it was before the Reschedule CT feature was
 *  first applied to a semester.
 *
 *  Only the sittings the reschedule can move are stored (CSE level-term class
 *  tests sitting in week 10 or later), so restoring touches nothing else. The
 *  row is written once — the very first Apply — and every later Apply re-plans
 *  from it, which is what makes "reschedule again and again" idempotent and what
 *  makes Restore always return to the true original. Regenerating the whole CT
 *  schedule drops the row, since the schedule it snapshots no longer exists. */
@Entity('ct_reschedule_snapshots')
export class CTRescheduleSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index({ unique: true })
  semester_id: string;

  /** The pre-reschedule state of every movable sitting, as `CTSnapshotAssignment[]`. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  original_assignments: CTSnapshotAssignment[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToOne(() => Semester, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;
}
