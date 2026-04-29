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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
