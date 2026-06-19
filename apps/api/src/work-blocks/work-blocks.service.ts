import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkBlockDto } from './dto/create-work-block.dto';
import { UpdateWorkBlockDto } from './dto/update-work-block.dto';

const includeTags = {
  tags: {
    orderBy: {
      name: 'asc' as const,
    },
  },
};

@Injectable()
export class WorkBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(from?: string, to?: string) {
    const fromDate = from ? this.parseDate(from, 'from') : undefined;
    const toDate = to ? this.parseDate(to, 'to') : undefined;

    return this.prisma.workBlock.findMany({
      where: this.buildRangeFilter(fromDate, toDate),
      include: includeTags,
      orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const workBlock = await this.prisma.workBlock.findUnique({
      where: { id },
      include: includeTags,
    });

    if (!workBlock) {
      throw new NotFoundException('Work block not found.');
    }

    return workBlock;
  }

  async create(dto: CreateWorkBlockDto) {
    const startedAt = this.parseDate(dto.startedAt, 'startedAt');
    const endedAt = this.parseDate(dto.endedAt, 'endedAt');
    this.assertValidRange(startedAt, endedAt);

    const tagIds = this.uniqueTagIds(dto.tagIds);
    await this.assertTagsExist(tagIds);

    return this.prisma.workBlock.create({
      data: {
        title: this.normalizeRequiredText(dto.title, 'title'),
        notes: this.normalizeOptionalText(dto.notes),
        startedAt,
        endedAt,
        tags: {
          connect: tagIds.map((id) => ({ id })),
        },
      },
      include: includeTags,
    });
  }

  async update(id: string, dto: UpdateWorkBlockDto) {
    const current = await this.findOne(id);
    const startedAt = dto.startedAt
      ? this.parseDate(dto.startedAt, 'startedAt')
      : current.startedAt;
    const endedAt = dto.endedAt ? this.parseDate(dto.endedAt, 'endedAt') : current.endedAt;
    this.assertValidRange(startedAt, endedAt);

    const tagIds = dto.tagIds === undefined ? undefined : this.uniqueTagIds(dto.tagIds);
    if (tagIds) {
      await this.assertTagsExist(tagIds);
    }

    return this.prisma.workBlock.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: this.normalizeRequiredText(dto.title, 'title') } : {}),
        ...(dto.notes !== undefined ? { notes: this.normalizeOptionalText(dto.notes) } : {}),
        ...(dto.startedAt !== undefined ? { startedAt } : {}),
        ...(dto.endedAt !== undefined ? { endedAt } : {}),
        ...(tagIds !== undefined ? { tags: { set: tagIds.map((tagId) => ({ id: tagId })) } } : {}),
      },
      include: includeTags,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.workBlock.delete({ where: { id } });
    return { id };
  }

  private buildRangeFilter(fromDate?: Date, toDate?: Date) {
    if (fromDate && toDate) {
      return {
        startedAt: { lt: toDate },
        endedAt: { gt: fromDate },
      };
    }

    if (fromDate) {
      return { endedAt: { gte: fromDate } };
    }

    if (toDate) {
      return { startedAt: { lte: toDate } };
    }

    return {};
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date.`);
    }

    return date;
  }

  private assertValidRange(startedAt: Date, endedAt: Date): void {
    if (endedAt <= startedAt) {
      throw new BadRequestException('endedAt must be after startedAt.');
    }
  }

  private async assertTagsExist(tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) {
      return;
    }

    const count = await this.prisma.tag.count({
      where: {
        id: {
          in: tagIds,
        },
      },
    });

    if (count !== tagIds.length) {
      throw new BadRequestException('One or more tags do not exist.');
    }
  }

  private normalizeOptionalText(value?: string): string | null {
    if (value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeRequiredText(value: string, field: string): string {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException(`${field} cannot be empty.`);
    }

    return trimmed;
  }

  private uniqueTagIds(tagIds?: string[]): string[] {
    return Array.from(new Set(tagIds ?? []));
  }
}
