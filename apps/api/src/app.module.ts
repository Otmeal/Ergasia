import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TagsModule } from './tags/tags.module';
import { WorkBlocksModule } from './work-blocks/work-blocks.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, WorkBlocksModule, TagsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
