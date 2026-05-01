import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../database/data-source';
import * as fs from 'fs';
import * as path from 'path';
import { Teacher } from '../entities/teacher.entity';
import { Room } from '../entities/room.entity';
import { Section } from '../entities/section.entity';
import { Course } from '../entities/course.entity';
import { Period } from '../entities/period.entity';
import { Day } from '../entities/day.entity';
import { Semester } from '../entities/semester.entity';
import { ClassSlot } from '../entities/class-slot.entity';
import { CourseSectionTeacher } from '../entities/course-section-teacher.entity';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

async function seed() {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    console.log('🌱 Starting database seeding...');

    const seedPath = path.join(__dirname, '../../../baust-cse-routine-management-system/src/data/seed.json');
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

    const teacherRepo = dataSource.getRepository(Teacher);
    const roomRepo = dataSource.getRepository(Room);
    const sectionRepo = dataSource.getRepository(Section);
    const courseRepo = dataSource.getRepository(Course);
    const periodRepo = dataSource.getRepository(Period);
    const dayRepo = dataSource.getRepository(Day);
    const semesterRepo = dataSource.getRepository(Semester);
    const classSlotRepo = dataSource.getRepository(ClassSlot);
    const cstRepo = dataSource.getRepository(CourseSectionTeacher);
    const userRepo = dataSource.getRepository(User);

    // Create a default admin user
    const adminExists = await userRepo.findOne({ where: { username: 'admin' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await userRepo.save(userRepo.create({ username: 'admin', password: hashedPassword }));
      console.log('✅ Admin user created (admin / admin123)');
    }

    // Clear existing data (optional, but good for clean seed)
    // await dataSource.dropDatabase();
    // await dataSource.synchronize();

    // Create semesters
    const semesters: Semester[] = [];
    for (let y = 2026; y <= 2028; y++) {
      semesters.push(await semesterRepo.save(semesterRepo.create({ id: `sem-winter-${y}`, name: `Winter ${y}`, year: y, season: 'Winter' })));
      semesters.push(await semesterRepo.save(semesterRepo.create({ id: `sem-summer-${y}`, name: `Summer ${y}`, year: y, season: 'Summer' })));
    }
    const activeSemester = semesters[0];
    console.log(`✅ ${semesters.length} semesters created`);

    // Migrate teachers
    const teachers = await teacherRepo.save(seedData.teachers.map(t => ({ ...t, assigned_credit: Number(t.assigned_credit) })));
    console.log(`✅ ${teachers.length} teachers migrated`);

    // Migrate rooms
    const rooms = await roomRepo.save(seedData.rooms);
    console.log(`✅ ${rooms.length} rooms migrated`);

    // Migrate sections
    const sections = await sectionRepo.save(seedData.sections);
    console.log(`✅ ${sections.length} sections migrated`);

    // Migrate courses
    const courses = await courseRepo.save(seedData.courses.map(c => ({
        ...c,
        course_type: classifyType(c.theory, c.sessional, c.credit)
    })));
    console.log(`✅ ${courses.length} courses migrated`);

    // Migrate periods
    const periods = await periodRepo.save(seedData.periods);
    console.log(`✅ ${periods.length} periods migrated`);

    // Migrate days
    const days = await dayRepo.save(seedData.days);
    console.log(`✅ ${days.length} days migrated`);

    // Helper maps
    const teacherMap = new Map(teachers.map(t => [t.short_name, t.id]));
    const roomMap = new Map(rooms.map(r => [r.name, r.id]));
    const courseMap = new Map(courses.map(c => [`${c.code}|${c.level}|${c.term}`, c.id]));
    const sectionMap = new Map(sections.map(s => [`${s.level}|${s.term}|${s.name}`, s.id]));

    // Migrate assignments and slots
    for (const a of seedData.assignments) {
      const cid = courseMap.get(`${a.course_code}|${a.level}|${a.term}`);
      const sid = sectionMap.get(`${a.level}|${a.term}|${a.section_name}`);
      if (!cid || !sid) continue;

      const teacher_ids = a.teachers
        .map(sn => teacherMap.get(sn))
        .filter(id => !!id);

      const cst = await cstRepo.save({
        semester_id: activeSemester.id,
        course_id: cid,
        section_id: sid,
        teacher_ids
      } as any);

      for (const cls of a.classes) {
        const room_id = cls.room ? roomMap.get(cls.room) : null;
        await classSlotRepo.save({
          semester_id: activeSemester.id,
          course_id: cid,
          section_id: sid,
          day: cls.day,
          start: cls.start,
          end: cls.end,
          room_id: room_id || null,
          week: cls.week || 'EVERY'
        } as any);
      }
    }
    console.log('✅ Assignments and class slots migrated');

    console.log('🚀 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await dataSource.destroy();
  }
}

function classifyType(theory: number, sessional: number, credit: number): string {
  if (sessional > 0) {
    if (credit <= 1.0) return "sessional_0.75";
    return "sessional_1.5";
  }
  if (credit >= 3.0) return "theory_3.0";
  return "theory_2.0";
}

seed();
