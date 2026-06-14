import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ClassSlot } from './class-slot.entity';
import { CourseSectionTeacher } from './course-section-teacher.entity';
import { Year } from './year.entity';
import { SemesterType } from './semester-type.entity';

@Entity('semesters')
@Index(['year_id', 'type_id'], { unique: true })
export class Semester {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'uuid' })
  year_id: string;

  @Column({ type: 'uuid' })
  type_id: string;

  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;

  @ManyToOne(() => Year, (year) => year.semesters)
  @JoinColumn({ name: 'year_id' })
  year_ref: Year;

  @ManyToOne(() => SemesterType, (st) => st.semesters)
  @JoinColumn({ name: 'type_id' })
  type_ref: SemesterType;

  @OneToMany(() => ClassSlot, (slot) => slot.semester)
  classSlots: ClassSlot[];

  @OneToMany(() => CourseSectionTeacher, (cst) => cst.semester)
  courseSectionTeachers: CourseSectionTeacher[];
}
