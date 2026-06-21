import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { Department } from './department.entity';

export type CourseType = 'theory_2.0' | 'theory_3.0' | 'sessional_1.5' | 'sessional_0.75' | 'sessional_3.0';
export type DepartmentalType = 'Departmental' | 'Non-Departmental';

@Entity('courses')
@Unique('IDX_courses_code_level_term_dept', ['code', 'level', 'term', 'departmental_type', 'department_id'])
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
    enum: ['theory_2.0', 'theory_3.0', 'sessional_1.5', 'sessional_0.75', 'sessional_3.0'],
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

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
