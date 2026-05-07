import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class AddPrimaryRoomToCST1778126000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "course_section_teachers",
            new TableColumn({
                name: "primary_room_id",
                type: "uuid",
                isNullable: true,
            })
        );

        await queryRunner.createForeignKey(
            "course_section_teachers",
            new TableForeignKey({
                columnNames: ["primary_room_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "rooms",
                onDelete: "SET NULL",
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("course_section_teachers");
        const foreignKey = table.foreignKeys.find(
            (fk) => fk.columnNames.indexOf("primary_room_id") !== -1
        );
        await queryRunner.dropForeignKey("course_section_teachers", foreignKey);
        await queryRunner.dropColumn("course_section_teachers", "primary_room_id");
    }
}
