import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('sections')
@Index(['level', 'term', 'name'], { unique: true })
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

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
