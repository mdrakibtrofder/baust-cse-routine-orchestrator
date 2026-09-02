import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';

/** One break week in a semester's CT calendar. */
export interface CTBreak {
  /** The week number this break sits immediately before. */
  before_week: number;
  /** What to call it in the UI, e.g. "Mid Term Break". */
  name: string;
}

@Entity('ct_settings')
export class CTSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index({ unique: true })
  semester_id: string;

  @Column({ type: 'integer', default: 14 })
  total_weeks: number;

  @Column({ type: 'date', nullable: true })
  start_date: Date | null;

  /** Named break weeks (mid term, Eid, university holidays …), each pinned to
   *  the week number it sits *before*.
   *
   *  A break takes a calendar week out of teaching without renumbering anything:
   *  an entry `{ before_week: 8 }` means the calendar week that would have
   *  carried week 8 is the break, so weeks 8, 9, 10 … each fall one calendar
   *  week later. Several breaks may share a `before_week` — two consecutive
   *  break weeks before week 8 push it out by two — and their array order is the
   *  order they appear in the calendar. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  breaks: CTBreak[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;

  @OneToOne(() => Semester)
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;
}
