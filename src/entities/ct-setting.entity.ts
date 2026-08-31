import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';

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

  /** Week numbers that a break week (e.g. mid term) sits *before*.
   *
   *  A calendar week is taken out of teaching without renumbering anything: an
   *  entry `8` means the calendar week that would have carried week 8 is the
   *  break, and weeks 8, 9, 10 … each fall one calendar week later than their
   *  position implies. Week numbers, and therefore every stored assignment's
   *  `week_number`, are untouched — only the dates behind them move. */
  @Column({ type: 'integer', array: true, default: () => "'{}'" })
  break_weeks: number[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;

  @OneToOne(() => Semester)
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;
}
