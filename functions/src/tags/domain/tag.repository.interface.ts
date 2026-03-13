import { Tag } from './tag.entity';

export abstract class TagRepository {
  abstract findAllByAccount(accountId: string): Promise<Tag[]>;
  abstract findById(id: string): Promise<Tag | null>;
  abstract save(tag: Tag): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
