import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Department } from './department.entity';
import { Section } from './section.entity';

@Entity('priority_classes')
@Index(['semester_id'])
@Index(['semester_id', 'department_id'])
export class PriorityClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  department_id: string;

  @Column({ type: 'integer' })
  level: number;

  @Column({ type: 'varchar', length: 10 })
  term: string;

  @Column({ type: 'uuid' })
  section_id: string;

  @Column({ type: 'uuid', array: true, default: () => 'array[]::uuid[]' })
  course_ids: string[];

  @Column({ type: 'uuid', array: true, default: () => 'array[]::uuid[]' })
  room_ids: string[];

  @Column({ type: 'jsonb', nullable: true })
  time_slots: { start: string; end: string }[] | null;

  @Column({ type: 'varchar', array: true, default: () => 'array[]::varchar[]' })
  days: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Semester, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;

  @ManyToOne(() => Department, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section;
}
