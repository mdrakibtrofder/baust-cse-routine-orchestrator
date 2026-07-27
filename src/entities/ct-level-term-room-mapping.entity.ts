import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Department } from './department.entity';

/**
 * Which room(s) a level-term (e.g. "Level 1 Term I") can use for CTs — a
 * level-term can map to multiple rooms so more than one course at that
 * level-term can test in parallel on the same day. One row per
 * level+term+departmental_type+department bucket.
 */
@Entity('ct_level_term_room_mappings')
@Index(['semester_id', 'level', 'term', 'departmental_type', 'department_id'], { unique: true })
export class CTLevelTermRoomMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'integer' })
  level: number;

  @Column({ type: 'varchar', length: 10, enum: ['I', 'II'] })
  term: 'I' | 'II';

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['Departmental', 'Non-Departmental'],
    default: 'Departmental',
  })
  departmental_type: 'Departmental' | 'Non-Departmental';

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  @Column({ type: 'uuid', array: true, default: () => 'array[]::uuid[]' })
  room_ids: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Semester, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;
}
