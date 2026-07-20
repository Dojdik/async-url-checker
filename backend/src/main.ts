import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cluster from 'cluster';
import { JobWorker } from './processor/JobWorker';
import { Job } from './common/Job';

async function bootstrap() {
    if (cluster.isPrimary) {
        //Nest.JS main
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
        console.log('job')
        //Job worker
        const jobWorker = new JobWorker()
        process.on('message', (message) => {
            const job = (message as Job)
            if (job.urls) {
                console.log("J", job)
                jobWorker.addJob(job)
                jobWorker.start()
            }
        })

        jobWorker.on('job_status', console.log)
        process.send?.("ready")
        console.log("R")
    }
}
bootstrap();