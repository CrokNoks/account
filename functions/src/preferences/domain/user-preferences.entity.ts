export interface DashboardWidgetConfig {
  id: string;
  width: number;
  desktopVisible: boolean;
  mobileVisible: boolean;
}

export interface DashboardLayout {
  widgets: DashboardWidgetConfig[];
}

export interface UserPreferencesProps {
  userId: string;
  dashboardLayout: DashboardLayout;
  updatedAt: Date;
}

export class UserPreferences {
  public readonly userId: string;
  public readonly dashboardLayout: DashboardLayout;
  public readonly updatedAt: Date;

  constructor(props: UserPreferencesProps) {
    this.userId = props.userId;
    this.dashboardLayout = props.dashboardLayout;
    this.updatedAt = props.updatedAt;
  }

  static create(userId: string, layout?: DashboardLayout): UserPreferences {
    return new UserPreferences({
      userId,
      // Même disposition que DEFAULT_WIDGETS (front).
      dashboardLayout: layout || {
        widgets: [
          {
            id: 'stat-bank',
            width: 4,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'stat-upcoming',
            width: 4,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'stat-income',
            width: 4,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'net-worth',
            width: 6,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'upcoming',
            width: 6,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'anomalies',
            width: 12,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'breakdown',
            width: 6,
            desktopVisible: true,
            mobileVisible: true,
          },
          { id: 'tags', width: 6, desktopVisible: true, mobileVisible: true },
          {
            id: 'transactions',
            width: 12,
            desktopVisible: true,
            mobileVisible: true,
          },
        ],
      },
      updatedAt: new Date(),
    });
  }
}
