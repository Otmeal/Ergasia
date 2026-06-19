import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tag.findMany({
      include: {
        _count: {
          select: {
            workBlocks: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async create(dto: CreateTagDto) {
    try {
      return await this.prisma.tag.create({
        data: {
          name: this.normalizeName(dto.name),
          color: dto.color,
        },
        include: {
          _count: {
            select: {
              workBlocks: true,
            },
          },
        },
      });
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateTagDto) {
    await this.assertExists(id);

    try {
      return await this.prisma.tag.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: this.normalizeName(dto.name) } : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
        },
        include: {
          _count: {
            select: {
              workBlocks: true,
            },
          },
        },
      });
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.tag.delete({ where: { id } });
    return { id };
  }

  private async assertExists(id: string): Promise<void> {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found.');
    }
  }

  private rethrowConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Tag name already exists.');
    }
  }

  private normalizeName(name: string): string {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new BadRequestException('Tag name cannot be empty.');
    }

    return trimmed;
  }
}
