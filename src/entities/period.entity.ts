import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('periods')
export class Period {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'time' })
  start: string;

  @Column({ type: 'time' })
  end: string;

  @Column({ type: 'integer' })
  duration: number;

  @Column({ type: 'varchar', length: 20, enum: ['theory', 'sessional'] })
  kind: 'theory' | 'sessional';

  /** Marks this period as a break (e.g. lunch/prayer break) rather than a class slot.
   *  Rendered as a distinct BREAK column in routine views, gated by the global
   *  "show break column" setting. */
  @Column({ type: 'boolean', default: false })
  is_break: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
