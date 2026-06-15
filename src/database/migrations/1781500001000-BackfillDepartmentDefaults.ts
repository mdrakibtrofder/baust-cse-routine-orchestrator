import { MigrationInterface, QueryRunner } from "typeorm";

export class BackfillDepartmentDefaults1781500001000 implements MigrationInterface {
    name = 'BackfillDepartmentDefaults1781500001000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Resolve CSE and ENG department ids from the departments table
        const [cse] = await queryRunner.query(
            `SELECT id FROM departments WHERE short_name = 'CSE' LIMIT 1`
        );
        const [eng] = await queryRunner.query(
            `SELECT id FROM departments WHERE short_name = 'ENG' LIMIT 1`
        );

        if (!cse) {
            console.warn('[Migration] No department with short_name=CSE found — skipping backfill');
            return;
        }

        const cseId: string = cse.id;

        // rooms → all departmental + CSE by default
        await queryRunner.query(
            `UPDATE rooms SET departmental_type = 'Departmental', department_id = $1 WHERE department_id IS NULL`,
            [cseId]
        );

        // sections → all departmental + CSE by default
        await queryRunner.query(
            `UPDATE sections SET departmental_type = 'Departmental', department_id = $1 WHERE department_id IS NULL`,
            [cseId]
        );

        // courses — departmental → CSE
        await queryRunner.query(
            `UPDATE courses SET department_id = $1
             WHERE departmental_type = 'Departmental' AND department_id IS NULL`,
            [cseId]
        );

        // courses — non-departmental → ENG (if department exists), else leave null
        if (eng) {
            const engId: string = eng.id;
            await queryRunner.query(
                `UPDATE courses SET department_id = $1
                 WHERE departmental_type = 'Non-Departmental' AND department_id IS NULL`,
                [engId]
            );
        } else {
            console.warn('[Migration] No department with short_name=ENG found — non-departmental courses left without department_id');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE rooms    SET department_id = NULL`);
        await queryRunner.query(`UPDATE sections SET department_id = NULL`);
        await queryRunner.query(`UPDATE courses  SET department_id = NULL`);
    }
}
