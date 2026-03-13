import { Injectable } from '@nestjs/common';
import { TagRepository } from '../domain/tag.repository.interface';

@Injectable()
export class DeleteTagUseCase {
  constructor(private readonly tagRepository: TagRepository) {}

  async execute(id: string): Promise<void> {
    await this.tagRepository.delete(id);
  }
}
