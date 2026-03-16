import { Injectable, Inject } from '@nestjs/common';
import type { UserPreferencesRepository } from '../domain/user-preferences.repository.interface';
import { UserPreferences } from '../domain/user-preferences.entity';

@Injectable()
export class GetUserPreferencesUseCase {
  constructor(
    @Inject('UserPreferencesRepository')
    private readonly preferencesRepository: UserPreferencesRepository,
  ) {}

  async execute(userId: string): Promise<UserPreferences> {
    let preferences = await this.preferencesRepository.findByUserId(userId);

    if (!preferences) {
      preferences = UserPreferences.create(userId);
      await this.preferencesRepository.save(preferences);
    }

    return preferences;
  }
}
