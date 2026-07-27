import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Section } from '../../entities/section.entity';
import { ClassSlot } from '../../entities/class-slot.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { CreateSectionDto } from '../../dtos/section.dto';
import { UpdateSectionDto } from '../../dtos/update-dtos/update-section.dto';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(ClassSlot)
    private readonly classSlotRepository: Repository<ClassSlot>,
    @InjectRepository(CourseSectionTeacher)
    private readonly cstRepository: Repository<CourseSectionTeacher>,
  ) {}

  async findAll(level?: number, term?: 'I' | 'II') {
    const where: any = {};
    if (level) where.level = level;
    if (term) where.term = term;
    return this.sectionRepository.find({ where, order: { level: 'ASC', term: 'ASC', name: 'ASC' } });
  }

  async findById(id: string) {
    const section = await this.sectionRepository.findOne({ where: { id } });
    if (!section) throw new NotFoundException(`Section with ID ${id} not found`);
    return section;
  }

  /** Same level+term+name is only a clash within the same department.
   *  Different departments may freely reuse the same section name (e.g. both
   *  CSE and EEE can have a "Section A" for Level 2 Term I). */
  private async assertNoDuplicate(
    level: number,
    term: 'I' | 'II',
    name: string,
    department_id: string | null | undefined,
    ignoreId?: string,
  ) {
    const existing = await this.sectionRepository
      .createQueryBuilder('section')
      .where('section.level = :level', { level })
      .andWhere('section.term = :term', { term })
      .andWhere('LOWER(section.name) = LOWER(:name)', { name })
      .andWhere(
        department_id ? 'section.department_id = :department_id' : 'section.department_id IS NULL',
        department_id ? { department_id } : {},
      )
      .andWhere(ignoreId ? 'section.id != :ignoreId' : '1=1', ignoreId ? { ignoreId } : {})
      .getOne();

    if (existing) {
      throw new ConflictException(
        `Section "${name}" already exists for Level ${level} Term ${term} in this department.`,
      );
    }
  }

  async create(dto: CreateSectionDto) {
    await this.assertNoDuplicate(dto.level, dto.term, dto.name, dto.department_id);
    const section = this.sectionRepository.create(dto);
    return this.sectionRepository.save(section);
  }

  async update(id: string, dto: UpdateSectionDto) {
    const current = await this.findById(id);
    await this.assertNoDuplicate(
      dto.level ?? current.level,
      dto.term ?? current.term,
      dto.name ?? current.name,
      dto.department_id !== undefined ? dto.department_id : current.department_id,
      id,
    );
    const res = await this.sectionRepository.update(id, dto);
    if (res.affected === 0) throw new NotFoundException(`Section with ID ${id} not found`);
    return this.findById(id);
  }

  async delete(id: string) {
    const section = await this.findById(id);

    const [slotCount, assignmentCount] = await Promise.all([
      this.classSlotRepository.count({ where: { section_id: id } }),
      this.cstRepository.count({ where: { section_id: id } }),
    ]);

    if (slotCount > 0 || assignmentCount > 0) {
      throw new ConflictException(
        `Cannot delete section "${section.name}": ${slotCount} class slot(s) and ${assignmentCount} teacher assignment(s) still reference it. Remove them first.`,
      );
    }

    await this.sectionRepository.remove(section);
    return { success: true };
  }
}
