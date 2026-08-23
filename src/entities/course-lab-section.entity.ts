import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Course } from './course.entity';

@Entity('course_lab_sections')
@Unique('UQ_course_lab_sections_semester_course_label', ['semester_id', 'course_id', 'label'])
@Index(['semester_id', 'course_id'])
export class CourseLabSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  course_id: string;

  /** Display label for this lab section, e.g. "A", "B", "C" */
  @Column({ type: 'varchar', length: 20 })
  label: string;

  /** The actual section(s) this lab section's classes count toward — many-to-many,
   *  e.g. Lab Section B may map to both actual Section A and Section B. */
  @Column({ type: 'uuid', array: true, default: () => 'array[]::uuid[]' })
  section_ids: string[];

  @Column({ type: 'uuid', array: true, default: () => 'array[]::uuid[]' })
  teacher_ids: string[];


  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Semester, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

}
