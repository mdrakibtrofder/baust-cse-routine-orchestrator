import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';

@Entity('ct_week_configs')
@Index(['semester_id', 'week_number', 'date'], { unique: true })
export class CTWeekConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'integer' })
  week_number: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'boolean', default: true })
  is_available: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Semester)
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;
}
