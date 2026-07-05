import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './database/data-source';
import { TeachersModule } from './modules/teachers/teachers.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { SectionsModule } from './modules/sections/sections.module';
import { CoursesModule } from './modules/courses/courses.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { DaysModule } from './modules/days/days.module';
import { SemestersModule } from './modules/semesters/semesters.module';
import { YearsModule } from './modules/years/years.module';
import { SemesterTypesModule } from './modules/semester-types/semester-types.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { ClassSlotsModule } from './modules/class-slots/class-slots.module';
import { RoutineModule } from './modules/routine/routine.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TeacherUnavailabilityModule } from './modules/teacher-unavailability/teacher-unavailability.module';
import { RoomUnavailabilityModule } from './modules/room-unavailability/room-unavailability.module';
import { RoutineGeneratorModule } from './modules/routine-generator/routine-generator.module';
import { CTScheduleModule } from './modules/ct-schedule/ct-schedule.module';
import { LabSectionsModule } from './modules/lab-sections/lab-sections.module';
import { AppSettingsModule } from './modules/app-settings/app-settings.module';
import { PriorityClassesModule } from './modules/priority-classes/priority-classes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      // Automatically retry connecting on startup (handles transient Supabase hiccups)
      retryAttempts: 10,
      retryDelay: 3000,
    }),
    TeachersModule,
    RoomsModule,
    DepartmentsModule,
    SectionsModule,
    CoursesModule,
    PeriodsModule,
    DaysModule,
    SemestersModule,
    YearsModule,
    SemesterTypesModule,
    AssignmentsModule,
    ClassSlotsModule,
    RoutineModule,
    AuthModule,
    UsersModule,
    TeacherUnavailabilityModule,
    RoomUnavailabilityModule,
    RoutineGeneratorModule,
    CTScheduleModule,
    LabSectionsModule,
    AppSettingsModule,
    PriorityClassesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
