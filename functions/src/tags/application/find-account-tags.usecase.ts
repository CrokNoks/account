import { Injectable } from '@nestjs/common';
import { TagRepository } from '../domain/tag.repository.interface';
import { Tag } from '../domain/tag.entity';

@Injectable()
export class FindAccountTagsUseCase {
  constructor(private readonly tagRepository: TagRepository) {}

  async execute(accountId: string): Promise<Tag[]> {
    return this.tagRepository.findAllByAccount(accountId);
  }
}
