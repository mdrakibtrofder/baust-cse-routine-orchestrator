import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './database/data-source';
import { TeachersModule } from './modules/teachers/teachers.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { SectionsModule } from './modules/sections/sections.module';
import { CoursesModule } from './modules/courses/courses.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { DaysModule } from './modules/days/days.module';
import { SemestersModule } from './modules/semesters/semesters.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { ClassSlotsModule } from './modules/class-slots/class-slots.module';
import { RoutineModule } from './modules/routine/routine.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    TeachersModule,
    RoomsModule,
    SectionsModule,
    CoursesModule,
    PeriodsModule,
    DaysModule,
    SemestersModule,
    AssignmentsModule,
    ClassSlotsModule,
    RoutineModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
