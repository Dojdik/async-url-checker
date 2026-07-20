import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import cluster from 'cluster';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  console.log('Worker started');
  
  // Обработка сигналов
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });
}

if (cluster.isWorker) {
  bootstrapWorker();
}