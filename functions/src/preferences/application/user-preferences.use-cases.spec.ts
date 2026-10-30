import { GetUserPreferencesUseCase } from './get-user-preferences.use-case';
import { UpdateUserPreferencesUseCase } from './update-user-preferences.use-case';
import {
  DashboardWidgetConfig,
  UserPreferences,
} from '../domain/user-preferences.entity';
import type { UserPreferencesRepository } from '../domain/user-preferences.repository.interface';

describe('User preferences use cases', () => {
  let repository: jest.Mocked<UserPreferencesRepository>;

  beforeEach(() => {
    repository = {
      findByUserId: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('UserPreferences.create', () => {
    it('provides a default dashboard with every widget visible', () => {
      const prefs = UserPreferences.create('user-1');

      expect(prefs.userId).toBe('user-1');
      expect(prefs.dashboardLayout.widgets.map((w) => w.id)).toEqual([
        'stat-start',
        'stat-income',
        'stat-expenses',
        'stat-bank',
        'stat-upcoming',
        'stat-forecast',
        'net-worth',
        'pulse',
        'anomalies',
        'breakdown',
        'top-expenses',
        'transactions',
      ]);
      expect(
        prefs.dashboardLayout.widgets.every(
          (w) => w.desktopVisible && w.mobileVisible,
        ),
      ).toBe(true);
    });

    it('uses the given layout when provided', () => {
      const layout = {
        widgets: [
          {
            id: 'pulse',
            width: 12,
            desktopVisible: true,
            mobileVisible: false,
          },
        ],
      };

      expect(UserPreferences.create('user-1', layout).dashboardLayout).toBe(
        layout,
      );
    });
  });

  describe('GetUserPreferencesUseCase', () => {
    it('returns the stored preferences without saving', async () => {
      const stored = UserPreferences.create('user-1');
      repository.findByUserId.mockResolvedValue(stored);

      expect(
        await new GetUserPreferencesUseCase(repository).execute('user-1'),
      ).toBe(stored);
      expect(repository.findByUserId).toHaveBeenCalledWith('user-1');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('creates and saves default preferences on first access', async () => {
      const prefs = await new GetUserPreferencesUseCase(repository).execute(
        'user-1',
      );

      expect(prefs.userId).toBe('user-1');
      expect(prefs.dashboardLayout.widgets).toHaveLength(12);
      expect(repository.save).toHaveBeenCalledWith(prefs);
    });
  });

  describe('UpdateUserPreferencesUseCase', () => {
    it('saves the layout for the user', async () => {
      const prefs = await new UpdateUserPreferencesUseCase(repository).execute({
        userId: 'user-1',
        dashboardLayout: {
          widgets: [
            {
              id: 'pulse',
              width: 6,
              desktopVisible: false,
              mobileVisible: true,
            },
          ],
        },
      });

      expect(prefs.userId).toBe('user-1');
      expect(prefs.dashboardLayout.widgets).toEqual([
        { id: 'pulse', width: 6, desktopVisible: false, mobileVisible: true },
      ]);
      expect(repository.save).toHaveBeenCalledWith(prefs);
    });

    it('defaults missing visibility flags to true', async () => {
      const prefs = await new UpdateUserPreferencesUseCase(repository).execute({
        userId: 'user-1',
        dashboardLayout: {
          widgets: [
            { id: 'pulse', width: 6 } as DashboardWidgetConfig,
            {
              id: 'anomalies',
              width: 12,
              mobileVisible: false,
            } as DashboardWidgetConfig,
          ],
        },
      });

      expect(prefs.dashboardLayout.widgets).toEqual([
        { id: 'pulse', width: 6, desktopVisible: true, mobileVisible: true },
        {
          id: 'anomalies',
          width: 12,
          desktopVisible: true,
          mobileVisible: false,
        },
      ]);
    });

    it('replaces the whole layout (removed widgets disappear)', async () => {
      const prefs = await new UpdateUserPreferencesUseCase(repository).execute({
        userId: 'user-1',
        dashboardLayout: { widgets: [] },
      });

      expect(prefs.dashboardLayout.widgets).toEqual([]);
    });
  });
});
