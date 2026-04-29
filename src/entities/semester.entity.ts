import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ClassSlot } from './class-slot.entity';
import { CourseSectionTeacher } from './course-section-teacher.entity';

@Entity('semesters')
export class Semester {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'integer' })
  year: number;

  @Column({ type: 'varchar', length: 20, enum: ['Winter', 'Summer'] })
  season: 'Winter' | 'Summer';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ClassSlot, slot => slot.semester)
  classSlots: ClassSlot[];

  @OneToMany(() => CourseSectionTeacher, cst => cst.semester)
  courseSectionTeachers: CourseSectionTeacher[];
}
