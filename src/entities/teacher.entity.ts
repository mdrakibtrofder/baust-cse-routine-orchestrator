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

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  assigned_credit: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
