import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Department } from './department.entity';

@Entity('sections')
@Index(['level', 'term', 'name', 'department_id'], { unique: true })
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer' })
  level: number;

  @Column({ type: 'varchar', length: 10, enum: ['I', 'II'] })
  term: 'I' | 'II';

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'integer' })
  total_students: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['Departmental', 'Non-Departmental'],
    default: 'Departmental',
  })
  departmental_type: 'Departmental' | 'Non-Departmental';

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
