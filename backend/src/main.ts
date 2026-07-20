import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import cluster from 'node:cluster';
import { AppModule } from './app.module';
import { WorkerPoolService } from './master/worker-pool.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  if (cluster.isPrimary) {
    const app = await NestFactory.create(AppModule);

    const config = new DocumentBuilder()
      .setTitle('Async URL Checker')
      .setDescription('Distributed async URL checker (master/worker cluster)')
      .setVersion('1.0')
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, documentFactory);

    app.setGlobalPrefix('/api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );

    const port = Number(process.env.PORT) || 3001;

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

    logger.log(`Master listening on port ${port}`);

    // Fork workers only after the HTTP server is bound successfully
    const workerPool = app.get(WorkerPoolService);
    workerPool.start();
  } else {
    // Avoid unhandled EPIPE when the master restarts under --watch
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
