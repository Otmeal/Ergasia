import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateWorkBlockDto } from './dto/create-work-block.dto';
import { UpdateWorkBlockDto } from './dto/update-work-block.dto';
import { WorkBlocksService } from './work-blocks.service';

@Controller('work-blocks')
export class WorkBlocksController {
  constructor(private readonly workBlocksService: WorkBlocksService) {}

  @Get()
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.workBlocksService.findAll(from, to);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workBlocksService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateWorkBlockDto) {
    return this.workBlocksService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkBlockDto) {
    return this.workBlocksService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workBlocksService.remove(id);
  }
}
