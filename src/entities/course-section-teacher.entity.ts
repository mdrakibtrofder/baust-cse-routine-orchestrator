import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Course } from './course.entity';
import { Section } from './section.entity';
import { Room } from './room.entity';

@Entity('course_section_teachers')
@Index(['semester_id', 'course_id', 'section_id'], { unique: true })
export class CourseSectionTeacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  course_id: string;

  @Column({ type: 'uuid' })
  section_id: string;

  @Column({ type: 'uuid', array: true, default: () => 'array[]::uuid[]' })
  teacher_ids: string[];

  @Column({ type: 'uuid', nullable: true })
  primary_room_id: string | null;

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

  @ManyToOne(() => Section)
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @ManyToOne(() => Room, { nullable: true })
  @JoinColumn({ name: 'primary_room_id' })
  primary_room: Room | null;
}
