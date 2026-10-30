import { Injectable } from '@nestjs/common';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import { TagRepository } from '../domain/tag.repository.interface';

@Injectable()
export class DeleteTagUseCase {
  constructor(private readonly tagRepository: TagRepository) {}

  async execute(accountId: string, id: string): Promise<void> {
    ensureBelongsToAccount(
      await this.tagRepository.findById(id),
      accountId,
      'Tag',
    );
    await this.tagRepository.delete(id);
  }
}
