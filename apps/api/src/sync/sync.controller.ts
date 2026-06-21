import { Body, Controller, Post } from '@nestjs/common';
import { SyncRequestDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  sync(@Body() dto: SyncRequestDto) {
    return this.syncService.sync(dto);
  }
}
