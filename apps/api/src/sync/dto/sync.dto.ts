import { Type } from 'class-transformer';
import { IsArray, IsISO8601, IsIn, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export const syncEntities = ['tag', 'workBlock'] as const;
export const syncActions = ['create', 'update', 'delete'] as const;

export type SyncEntity = (typeof syncEntities)[number];
export type SyncAction = (typeof syncActions)[number];

export class SyncOperationDto {
  @IsString()
  operationId!: string;

  @IsIn(syncEntities)
  entity!: SyncEntity;

  @IsIn(syncActions)
  action!: SyncAction;

  @IsUUID()
  recordId!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  queuedAt?: string;
}

export class SyncRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations!: SyncOperationDto[];
}
