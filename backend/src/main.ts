import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cluster from 'node:cluster';
import { AppModule } from './app.module';
import { WorkerPoolService } from './master/worker-pool.service';
import type { AppConfiguration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  if (cluster.isPrimary) {
    const app = await NestFactory.create(AppModule);
    const config = app.get(ConfigService<AppConfiguration, true>);
    const port = config.get('port', { infer: true });

    const swagger = new DocumentBuilder()
      .setTitle('Async URL Checker')
      .setDescription('Distributed async URL checker (master/worker cluster)')
      .setVersion('1.0')
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('docs', app, documentFactory);

    app.setGlobalPrefix('/api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );

    try {
      await app.listen(port);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EADDRINUSE') {
        logger.error(
          `Port ${port} is already in use. Stop the other process or set PORT=...`,
        );
        process.exit(1);
      }
      throw error;
    }

    logger.log(
      `Master listening on port ${port} (workers=${config.get('workersCount', { infer: true })})`,
    );

    const workerPool = app.get(WorkerPoolService);
    workerPool.start();
  } else {
    process.on('disconnect', () => {
      process.exit(0);
    });
    process.on('error', () => {
      // ignore IPC errors during master reload
    });

    await NestFactory.createApplicationContext(AppModule);
    logger.log(`Worker ${cluster.worker?.id} started`);
  }
}

void bootstrap();
