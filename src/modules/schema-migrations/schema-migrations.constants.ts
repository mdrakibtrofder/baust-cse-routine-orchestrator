export const SCHEMA_MIGRATIONS_QUEUE = 'schema-migrations';

export const PUBLIC_ONLY_TABLES = [
  'years',
  'semester_types',
  'semesters',
  'users',
  'app_settings',
  'schema_migration_logs',
  'routine_generation_runs',
  'routine_generation_logs',
] as const;

export const PROVISIONING_DATA_TABLES = [
  'departments',
  'teachers',
  'rooms',
  'sections',
  'courses',
  'days',
  'periods',
  'teacher_unavailability',
  'room_unavailability',
] as const;
