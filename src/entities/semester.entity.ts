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

  @Column({ type: 'varchar', length: 150, nullable: true, unique: true })
  schema_name: string | null;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  schema_status: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  schema_source_name: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  schema_last_synced_at: Date | null;

  @Column({ type: 'text', nullable: true })
  schema_error: string | null;

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
