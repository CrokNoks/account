import { Injectable, Inject } from '@nestjs/common';
import type { UserPreferencesRepository } from '../domain/user-preferences.repository.interface';
import { UserPreferences, DashboardLayout } from '../domain/user-preferences.entity';

export interface UpdateUserPreferencesCommand {
  userId: string;
  dashboardLayout: DashboardLayout;
}

@Injectable()
export class UpdateUserPreferencesUseCase {
  constructor(
    @Inject('UserPreferencesRepository')
    private readonly preferencesRepository: UserPreferencesRepository,
  ) {}

  async execute(command: UpdateUserPreferencesCommand): Promise<UserPreferences> {
    const normalizedWidgets = command.dashboardLayout.widgets.map(w => ({
      ...w,
      desktopVisible: w.desktopVisible ?? true,
      mobileVisible: w.mobileVisible ?? true,
    }));

    const preferences = new UserPreferences({
      userId: command.userId,
      dashboardLayout: {
        ...command.dashboardLayout,
        widgets: normalizedWidgets,
      },
      updatedAt: new Date(),
    });

    await this.preferencesRepository.save(preferences);
    return preferences;
  }
}
