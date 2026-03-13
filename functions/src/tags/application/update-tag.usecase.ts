import { Injectable, NotFoundException } from '@nestjs/common';
import { TagRepository } from '../domain/tag.repository.interface';
import { Tag } from '../domain/tag.entity';

export interface UpdateTagCommand {
  id: string;
  name?: string;
  color?: string;
}

@Injectable()
export class UpdateTagUseCase {
  constructor(private readonly tagRepository: TagRepository) {}

  async execute(command: UpdateTagCommand): Promise<Tag> {
    const existing = await this.tagRepository.findById(command.id);
    if (!existing) {
      throw new NotFoundException(`Tag with ID ${command.id} not found`);
    }

    const updated = new Tag({
      id: existing.id,
      accountId: existing.accountId,
      name: command.name ?? existing.name,
      color: command.color ?? existing.color,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.tagRepository.save(updated);
    return updated;
  }
}
