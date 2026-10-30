import { Injectable } from '@nestjs/common';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import { TagRepository } from '../domain/tag.repository.interface';
import { Tag } from '../domain/tag.entity';

export interface UpdateTagCommand {
  accountId: string;
  id: string;
  name?: string;
  color?: string;
}

@Injectable()
export class UpdateTagUseCase {
  constructor(private readonly tagRepository: TagRepository) {}

  async execute(command: UpdateTagCommand): Promise<Tag> {
    const existing = ensureBelongsToAccount(
      await this.tagRepository.findById(command.id),
      command.accountId,
      'Tag',
    );

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
