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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => Semester)
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;
}
