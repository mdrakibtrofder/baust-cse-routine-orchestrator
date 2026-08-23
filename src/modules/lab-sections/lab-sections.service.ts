import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CourseLabSection } from '../../entities/course-lab-section.entity';
import { ClassSlot } from '../../entities/class-slot.entity';
import { BatchSaveLabSectionsDto, UpdateLabSectionDto } from '../../dtos/lab-section.dto';

@Injectable()
export class LabSectionsService {
  constructor(
    @InjectRepository(CourseLabSection)
    private readonly repo: Repository<CourseLabSection>,
    @InjectRepository(ClassSlot)
    private readonly slotRepo: Repository<ClassSlot>,
    private readonly dataSource: DataSource,
  ) {}

  async findBySemester(semesterId: string): Promise<CourseLabSection[]> {
    return this.repo.find({ where: { semester_id: semesterId } });
  }

  async findByCourse(semesterId: string, courseId: string): Promise<CourseLabSection[]> {
    return this.repo.find({ where: { semester_id: semesterId, course_id: courseId } });
  }

  /**
   * Atomically replace all lab sections for a course in a semester.
   * Deleted lab sections cascade-delete their class slots (via FK ON DELETE CASCADE).
   */
  async batchSave(dto: BatchSaveLabSectionsDto): Promise<CourseLabSection[]> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.find(CourseLabSection, {
        where: { semester_id: dto.semester_id, course_id: dto.course_id },
      });

      const incomingLabels = dto.lab_sections.map((g) => g.label);
      const toDelete = existing.filter((g) => !incomingLabels.includes(g.label));
      if (toDelete.length > 0) {
        for (const g of toDelete) {
          await manager.delete(ClassSlot, { lab_section_id: g.id });
        }
        await manager.remove(CourseLabSection, toDelete);
      }

      const results: CourseLabSection[] = [];
      for (const item of dto.lab_sections) {
        const match = existing.find((g) => g.label === item.label);
        if (match) {
          match.section_ids = item.section_ids;
          match.teacher_ids = item.teacher_ids;
          results.push(await manager.save(CourseLabSection, match));
        } else {
          const created = manager.create(CourseLabSection, {
            semester_id: dto.semester_id,
            course_id: dto.course_id,
            label: item.label,
            section_ids: item.section_ids,
            teacher_ids: item.teacher_ids,
          });
          results.push(await manager.save(CourseLabSection, created));
        }
      }
      return results;
    });
  }

  async update(id: string, dto: UpdateLabSectionDto): Promise<CourseLabSection> {
    const lg = await this.repo.findOne({ where: { id } });
    if (!lg) throw new NotFoundException(`Lab section ${id} not found`);
    if (dto.teacher_ids !== undefined) lg.teacher_ids = dto.teacher_ids;
    return this.repo.save(lg);
  }

  async delete(id: string): Promise<void> {
    const lg = await this.repo.findOne({ where: { id } });
    if (!lg) throw new NotFoundException(`Lab section ${id} not found`);
    await this.slotRepo.delete({ lab_section_id: id });
    await this.repo.remove(lg);
  }

  /**
   * Replace all class slots for a specific lab section, preserving locked slots. A slot represents one physical
   * meeting shared by every actual section in the lab section's `section_ids` mapping,
   * so `section_id` is left null on these slots — the affected sections are derived from
   * the lab section itself wherever slots are read (routine views, conflict checks).
   */
  async batchReplaceSlots(
    labSectionId: string,
    slots: Array<{ day: string; start: string; end: string; room_id: string; week?: string; locked?: boolean }>,
  ): Promise<ClassSlot[]> {
    const lg = await this.repo.findOne({ where: { id: labSectionId } });
    if (!lg) throw new NotFoundException(`Lab section ${labSectionId} not found`);

    return this.dataSource.transaction(async (manager) => {
      // Fetch existing slots
      const existingSlots = await manager.find(ClassSlot, {
        where: { lab_section_id: labSectionId },
      });
      
      // Delete all existing slots
      await manager.delete(ClassSlot, { lab_section_id: labSectionId });
      
      // Create new slots preserving locked status from input
      const entities = slots.map((s) =>
        manager.create(ClassSlot, {
          semester_id: lg.semester_id,
          course_id: lg.course_id,
          section_id: null,
          lab_section_id: labSectionId,
          day: s.day,
          start: s.start,
          end: s.end,
          room_id: s.room_id,
          week: (s.week || 'EVERY') as any,
          locked: s.locked ?? false,
        }),
      );
      
      return await manager.save(ClassSlot, entities);
    });
  }
}
