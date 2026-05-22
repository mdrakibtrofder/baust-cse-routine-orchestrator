import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

export type CourseType = 'theory_2.0' | 'theory_3.0' | 'sessional_1.5' | 'sessional_0.75';
export type DepartmentalType = 'Departmental' | 'Non-Departmental';

@Entity('courses')
@Unique('IDX_courses_code_level_term_dept', ['code', 'level', 'term', 'departmental_type'])
@Index(['level', 'term'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'numeric', precision: 3, scale: 2 })
  credit: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['theory_2.0', 'theory_3.0', 'sessional_1.5', 'sessional_0.75'],
  })
  course_type: CourseType;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['Departmental', 'Non-Departmental'],
    default: 'Departmental',
  })
  departmental_type: DepartmentalType;

  @Column({ type: 'integer' })
  level: number;

  @Column({ type: 'varchar', length: 10, enum: ['I', 'II'] })
  term: 'I' | 'II';

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  theory: number;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  sessional: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
