import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Course } from './course.entity';

/** A single class-test sitting for a course — one row per (course, ct_number).
 *  Not scoped to a section: a level-term's day/room mapping already implies
 *  every section at that level-term tests together, so there is nothing left
 *  to desynchronize between sections.
 *
 *  A sitting occupies *every* room mapped to its level-term (`room_ids`), since
 *  the whole cohort takes the test simultaneously spread across those rooms. */
@Entity('ct_assignments')
@Index(['semester_id', 'course_id', 'ct_number'], { unique: true })
export class CTAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  course_id: string;

  /** Every room the sitting occupies — the full room mapping of its level-term. */
  @Column({ type: 'uuid', array: true, default: () => 'array[]::uuid[]' })
  room_ids: string[];

  @Column({ type: 'integer' })
  week_number: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'integer' })
  ct_number: number; // 1, 2, 3

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;

  @ManyToOne(() => Semester)
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course: Course;
}
