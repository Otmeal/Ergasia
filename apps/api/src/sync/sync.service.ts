import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from '../tags/dto/create-tag.dto';
import { UpdateTagDto } from '../tags/dto/update-tag.dto';
import { TagsService } from '../tags/tags.service';
import { CreateWorkBlockDto } from '../work-blocks/dto/create-work-block.dto';
import { UpdateWorkBlockDto } from '../work-blocks/dto/update-work-block.dto';
import { WorkBlocksService } from '../work-blocks/work-blocks.service';
import { SyncOperationDto, SyncRequestDto, type SyncAction, type SyncEntity } from './dto/sync.dto';

type SyncResultStatus = 'applied' | 'failed';

type SyncOperationResult = {
  operationId: string;
  entity: SyncEntity;
  action: SyncAction;
  recordId: string;
  status: SyncResultStatus;
  message?: string;
  record?: unknown;
};

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tagsService: TagsService,
    private readonly workBlocksService: WorkBlocksService,
  ) {}

  async sync(dto: SyncRequestDto) {
    const results: SyncOperationResult[] = [];

    for (const operation of dto.operations) {
      try {
        const record = await this.applyOperation(operation);
        results.push(this.toResult(operation, 'applied', record));
      } catch (error) {
        results.push(this.toResult(operation, 'failed', undefined, this.getErrorMessage(error)));
      }
    }

    const [workBlocks, tags] = await Promise.all([
      this.workBlocksService.findAll(),
      this.tagsService.findAll(),
    ]);

    return {
      results,
      workBlocks,
      tags,
      serverTime: new Date().toISOString(),
    };
  }

  private applyOperation(operation: SyncOperationDto): Promise<unknown> {
    if (operation.entity === 'tag') {
      return this.applyTagOperation(operation);
    }

    return this.applyWorkBlockOperation(operation);
  }

  private async applyTagOperation(operation: SyncOperationDto): Promise<unknown> {
    if (operation.action === 'delete') {
      try {
        return await this.tagsService.remove(operation.recordId);
      } catch (error) {
        if (error instanceof NotFoundException) {
          return { id: operation.recordId };
        }

        throw error;
      }
    }

    if (operation.action === 'create') {
      const dto = await this.toDto(CreateTagDto, {
        ...this.requirePayload(operation),
        id: operation.recordId,
      });
      const existing = await this.prisma.tag.findUnique({
        where: { id: operation.recordId },
        select: { id: true },
      });

      if (existing) {
        return this.tagsService.update(operation.recordId, {
          name: dto.name,
          color: dto.color,
        });
      }

      return this.tagsService.create(dto);
    }

    const dto = await this.toDto(UpdateTagDto, this.requirePayload(operation));
    return this.tagsService.update(operation.recordId, dto);
  }

  private async applyWorkBlockOperation(operation: SyncOperationDto): Promise<unknown> {
    if (operation.action === 'delete') {
      try {
        return await this.workBlocksService.remove(operation.recordId);
      } catch (error) {
        if (error instanceof NotFoundException) {
          return { id: operation.recordId };
        }

        throw error;
      }
    }

    if (operation.action === 'create') {
      const dto = await this.toDto(CreateWorkBlockDto, {
        ...this.requirePayload(operation),
        id: operation.recordId,
      });
      const existing = await this.prisma.workBlock.findUnique({
        where: { id: operation.recordId },
        select: { id: true },
      });

      if (existing) {
        return this.workBlocksService.update(operation.recordId, {
          title: dto.title,
          notes: dto.notes,
          startedAt: dto.startedAt,
          endedAt: dto.endedAt,
          tagIds: dto.tagIds,
        });
      }

      return this.workBlocksService.create(dto);
    }

    const dto = await this.toDto(UpdateWorkBlockDto, this.requirePayload(operation));
    return this.workBlocksService.update(operation.recordId, dto);
  }

  private requirePayload(operation: SyncOperationDto): Record<string, unknown> {
    if (!operation.payload) {
      throw new BadRequestException('payload is required.');
    }

    return operation.payload;
  }

  private async toDto<T extends object>(
    dtoClass: ClassConstructor<T>,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const dto = plainToInstance(dtoClass, payload);
    const errors = await validate(dto, {
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      whitelist: true,
    });

    if (errors.length > 0) {
      const messages = errors
        .flatMap((error) => Object.values(error.constraints ?? {}))
        .filter((message) => message.length > 0);

      throw new BadRequestException(messages.join(' ') || 'Invalid sync payload.');
    }

    return dto;
  }

  private toResult(
    operation: SyncOperationDto,
    status: SyncResultStatus,
    record?: unknown,
    message?: string,
  ): SyncOperationResult {
    return {
      operationId: operation.operationId,
      entity: operation.entity,
      action: operation.action,
      recordId: operation.recordId,
      status,
      ...(message ? { message } : {}),
      ...(record ? { record } : {}),
    };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (typeof response === 'object' && response && 'message' in response) {
        const message = response.message;

        if (Array.isArray(message)) {
          return message.join(' ');
        }

        if (typeof message === 'string') {
          return message;
        }
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Sync operation failed.';
  }
}
