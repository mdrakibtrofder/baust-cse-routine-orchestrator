import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Course } from './course.entity';
import { Section } from './section.entity';
import { Room } from './room.entity';

@Entity('ct_assignments')
@Index(['semester_id', 'course_id', 'section_id', 'ct_number'], { unique: true })
export class CTAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  course_id: string;

  @Column({ type: 'uuid' })
  section_id: string;

  @Column({ type: 'uuid' })
  room_id: string;

  @Column({ type: 'integer' })
  week_number: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'integer' })
  ct_number: number; // 1, 2, 3

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
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

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'room_id' })
  room: Room;
}
