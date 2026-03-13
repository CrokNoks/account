import { Injectable } from '@nestjs/common';
import { TagRepository } from '../domain/tag.repository.interface';
import { Tag } from '../domain/tag.entity';

export interface CreateTagCommand {
  name: string;
  color: string;
  accountId: string;
}

@Injectable()
export class CreateTagUseCase {
  constructor(private readonly tagRepository: TagRepository) {}

  async execute(command: CreateTagCommand): Promise<Tag> {
    const tag = Tag.create({
      name: command.name,
      color: command.color,
      accountId: command.accountId,
    });

    await this.tagRepository.save(tag);
    return tag;
  }
}
