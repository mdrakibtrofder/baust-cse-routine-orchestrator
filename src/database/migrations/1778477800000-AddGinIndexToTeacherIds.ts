import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGinIndexToTeacherIds1778477800000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "idx_cst_teacher_ids" ON "course_section_teachers" USING GIN ("teacher_ids")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "idx_cst_teacher_ids"`);
    }
}
