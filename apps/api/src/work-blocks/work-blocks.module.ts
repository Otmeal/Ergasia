import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkBlocksController } from './work-blocks.controller';
import { WorkBlocksService } from './work-blocks.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkBlocksController],
  providers: [WorkBlocksService],
  exports: [WorkBlocksService],
})
export class WorkBlocksModule {}
