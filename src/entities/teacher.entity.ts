import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('teachers')
@Index(['short_name'], { unique: true })
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  short_name: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  designation: string;

  @Column({ type: 'varchar', length: 100 })
  department: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  status: string;

  /** Contact details. Blank rather than null so every consumer can treat them as
   *  plain strings — a teacher record is valid without either. */
  @Column({ type: 'varchar', length: 150, default: '' })
  email: string;

  @Column({ type: 'varchar', length: 30, default: '' })
  phone: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  assigned_credit_hours: number;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
