import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Department } from './department.entity';

@Entity('rooms')
@Index(['name'], { unique: true })
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** "Both" means the room can be used for either theory or sessional classes. */
  @Column({ type: 'varchar', length: 20, enum: ['Theory', 'Sessional', 'Both'] })
  room_type: 'Theory' | 'Sessional' | 'Both';

  @Column({ type: 'integer' })
  capacity: number;

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
