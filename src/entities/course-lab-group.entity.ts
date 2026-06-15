import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Course } from './course.entity';
import { Section } from './section.entity';
import { Room } from './room.entity';

@Entity('course_lab_groups')
@Unique('UQ_course_lab_groups_semester_course_label', ['semester_id', 'course_id', 'label'])
@Index(['semester_id', 'course_id'])
export class CourseLabGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  course_id: string;

  /** Display label for this lab group, e.g. "A", "B", "C" */
  @Column({ type: 'varchar', length: 20 })
  label: string;

  /** The actual section this lab group belongs to */
  @Column({ type: 'uuid' })
  section_id: string;

  @Column({ type: 'uuid', array: true, default: () => 'array[]::uuid[]' })
  teacher_ids: string[];

  @Column({ type: 'uuid', nullable: true })
  primary_room_id: string | null;

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

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @ManyToOne(() => Room, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_room_id' })
  primary_room: Room | null;
}
