import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSlotsService } from './modules/class-slots/class-slots.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ClassSlotsService);

  const slotId = 'eef4ff6d-3e64-4788-82a6-90a59ddab9b1';
  console.log(`Testing full update for slot ${slotId}`);

  try {
    // Send full payload matching the frontend's request
    const result = await service.update(slotId, {
      semester_id: 'fde3f00a-7dd0-44ce-b1d7-ac86bf4453cd',
      course_id: '30f8f1cc-ac6d-4fe6-a2c1-dc75aa6d5748',
      section_id: 'f5ad6031-db35-476f-940e-e7243960fc0b',
      day: 'SUN',
      start: '08:00:00',
      end: '08:50:00',
      room_id: null as any,
      week: 'EVERY',
      locked: true
    });
    console.log('Success!', result);
  } catch (err: any) {
    console.error('Failed with error:', err.message);
    if (err.response) {
      console.error('Response details:', JSON.stringify(err.response, null, 2));
    }
  } finally {
    await app.close();
  }
}

main();
