import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Course } from './course.entity';
import { Section } from './section.entity';
import { Room } from './room.entity';

@Entity('class_slots')
@Index(['semester_id', 'course_id', 'section_id'])
@Index(['semester_id', 'room_id'])
export class ClassSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  course_id: string;

  @Column({ type: 'uuid' })
  section_id: string;

  @Column({ type: 'uuid', nullable: true })
  room_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  day: string;

  @Column({ type: 'time' })
  start: string;

  @Column({ type: 'time' })
  end: string;

  @Column({ type: 'varchar', length: 20, enum: ['EVERY', 'EVEN', 'ODD'], default: 'EVERY' })
  week: 'EVERY' | 'EVEN' | 'ODD';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Semester, semester => semester.classSlots)
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @ManyToOne(() => Section)
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @ManyToOne(() => Room, { nullable: true })
  @JoinColumn({ name: 'room_id' })
  room: Room | null;
}
