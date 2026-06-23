import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { SchemaMigrationLog } from '../../entities/schema-migration-log.entity';

interface WriteSchemaMigrationLogInput {
  semesterId?: string | null;
  schemaName?: string | null;
  operation: string;
  status: string;
  level?: string;
  message: string;
  errorDetails?: string | null;
  durationMs?: number | null;
}

@Injectable()
export class SchemaMigrationLogService {
  constructor(
    @InjectRepository(SchemaMigrationLog)
    private readonly repo: Repository<SchemaMigrationLog>,
  ) {}

  async write(input: WriteSchemaMigrationLogInput): Promise<SchemaMigrationLog> {
    const entity = this.repo.create({
      semester_id: input.semesterId ?? null,
      schema_name: input.schemaName ?? null,
      operation: input.operation,
      status: input.status,
      level: input.level ?? 'INFO',
      message: input.message,
      error_details: input.errorDetails ?? null,
      duration_ms: input.durationMs ?? null,
    });
    return this.repo.save(entity);
  }

  async recent(limit = 100): Promise<SchemaMigrationLog[]> {
    return this.repo.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.repo.delete({ created_at: LessThan(cutoff) });
    return result.affected ?? 0;
  }
}
