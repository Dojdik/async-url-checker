import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cluster from 'cluster';
import { JobWorker } from './processor/JobWorker';

async function bootstrap() {
  if (cluster.isPrimary) {
    const app = await NestFactory.create(AppModule);

    const config = new DocumentBuilder()
      .setTitle('Async URL Checker')
      .setDescription('URL Checker')
      .setVersion('1.0')
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, documentFactory);
    app.setGlobalPrefix('/api')
    app.useGlobalPipes(new ValidationPipe({
      transform: true
    }));
    await app.listen(process.env.PORT ?? 3001);
  } else {
    const jobWorker = new JobWorker()
    cluster.once('message', () => {
      jobWorker.addJob()
    })
  }
}
bootstrap();