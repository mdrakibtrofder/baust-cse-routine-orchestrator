import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Room } from './room.entity';

@Entity('room_unavailability')
export class RoomUnavailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  room_id: string;

  @Column({ type: 'varchar', array: true })
  days: string[];

  @Column({ type: 'time' })
  start: string;

  @Column({ type: 'time' })
  end: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'room_id' })
  room: Room;
}
