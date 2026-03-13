import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TagRepository } from './domain/tag.repository.interface';
import { SupabaseTagRepository } from './infrastructure/supabase-tag.repository';
import { CreateTagUseCase } from './application/create-tag.usecase';
import { UpdateTagUseCase } from './application/update-tag.usecase';
import { DeleteTagUseCase } from './application/delete-tag.usecase';
import { FindAccountTagsUseCase } from './application/find-account-tags.usecase';
import { TagsController } from './infrastructure/tags.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [TagsController],
  providers: [
    {
      provide: TagRepository,
      useClass: SupabaseTagRepository,
    },
    CreateTagUseCase,
    UpdateTagUseCase,
    DeleteTagUseCase,
    FindAccountTagsUseCase,
  ],
  exports: [
    TagRepository,
    CreateTagUseCase,
    UpdateTagUseCase,
    DeleteTagUseCase,
    FindAccountTagsUseCase,
  ],
})
export class TagsModule {}
