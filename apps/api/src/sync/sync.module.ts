import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TagsModule } from '../tags/tags.module';
import { WorkBlocksModule } from '../work-blocks/work-blocks.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [PrismaModule, TagsModule, WorkBlocksModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
