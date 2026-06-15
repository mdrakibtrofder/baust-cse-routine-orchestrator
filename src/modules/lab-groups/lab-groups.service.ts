import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CourseLabGroup } from '../../entities/course-lab-group.entity';
import { ClassSlot } from '../../entities/class-slot.entity';
import { BatchSaveLabGroupsDto } from '../../dtos/lab-group.dto';

@Injectable()
export class LabGroupsService {
  constructor(
    @InjectRepository(CourseLabGroup)
    private readonly repo: Repository<CourseLabGroup>,
    @InjectRepository(ClassSlot)
    private readonly slotRepo: Repository<ClassSlot>,
    private readonly dataSource: DataSource,
  ) {}

  async findBySemester(semesterId: string): Promise<CourseLabGroup[]> {
    return this.repo.find({ where: { semester_id: semesterId } });
  }

  async findByCourse(semesterId: string, courseId: string): Promise<CourseLabGroup[]> {
    return this.repo.find({ where: { semester_id: semesterId, course_id: courseId } });
  }

  /**
   * Atomically replace all lab groups for a course in a semester.
   * Deleted lab groups cascade-delete their class slots (via FK ON DELETE CASCADE).
   */
  async batchSave(dto: BatchSaveLabGroupsDto): Promise<CourseLabGroup[]> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.find(CourseLabGroup, {
        where: { semester_id: dto.semester_id, course_id: dto.course_id },
      });

      const existingIds = existing.map((g) => g.id);
      // Remove class slots for lab groups being deleted
      const incomingLabels = dto.lab_groups.map((g) => g.label);
      const toDelete = existing.filter((g) => !incomingLabels.includes(g.label));
      if (toDelete.length > 0) {
        for (const g of toDelete) {
          await manager.delete(ClassSlot, { lab_group_id: g.id });
        }
        await manager.remove(CourseLabGroup, toDelete);
      }

      const results: CourseLabGroup[] = [];
      for (const item of dto.lab_groups) {
        const match = existing.find((g) => g.label === item.label);
        if (match) {
          match.section_id = item.section_id;
          match.teacher_ids = item.teacher_ids;
          match.primary_room_id = item.primary_room_id ?? null;
          results.push(await manager.save(CourseLabGroup, match));
        } else {
          const created = manager.create(CourseLabGroup, {
            semester_id: dto.semester_id,
            course_id: dto.course_id,
            label: item.label,
            section_id: item.section_id,
            teacher_ids: item.teacher_ids,
            primary_room_id: item.primary_room_id ?? null,
          });
          results.push(await manager.save(CourseLabGroup, created));
        }
      }
      return results;
    });
  }

  async delete(id: string): Promise<void> {
    const lg = await this.repo.findOne({ where: { id } });
    if (!lg) throw new NotFoundException(`Lab group ${id} not found`);
    // Delete associated slots first
    await this.slotRepo.delete({ lab_group_id: id });
    await this.repo.remove(lg);
  }

  /**
   * Replace all class slots for a specific lab group.
   */
  async batchReplaceSlots(
    labGroupId: string,
    slots: Array<{ day: string; start: string; end: string; room_id: string; week?: string }>,
  ): Promise<ClassSlot[]> {
    const lg = await this.repo.findOne({ where: { id: labGroupId } });
    if (!lg) throw new NotFoundException(`Lab group ${labGroupId} not found`);

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(ClassSlot, { lab_group_id: labGroupId });
      const entities = slots.map((s) =>
        manager.create(ClassSlot, {
          semester_id: lg.semester_id,
          course_id: lg.course_id,
          section_id: lg.section_id,
          lab_group_id: labGroupId,
          day: s.day,
          start: s.start,
          end: s.end,
          room_id: s.room_id,
          week: (s.week || 'EVERY') as any,
        }),
      );
      return manager.save(ClassSlot, entities);
    });
  }
}
