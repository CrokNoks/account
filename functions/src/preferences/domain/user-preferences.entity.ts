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
      dashboardLayout: layout || {
        widgets: [
          {
            id: 'stat-start',
            width: 2,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'stat-income',
            width: 2,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'stat-expenses',
            width: 2,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'stat-bank',
            width: 2,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'stat-upcoming',
            width: 2,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'stat-forecast',
            width: 2,
            desktopVisible: true,
            mobileVisible: true,
          },
          {
            id: 'net-worth',
            width: 6,
            desktopVisible: true,
            mobileVisible: true,
          },
          { id: 'pulse', width: 6, desktopVisible: true, mobileVisible: true },
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
          {
            id: 'top-expenses',
            width: 6,
            desktopVisible: true,
            mobileVisible: true,
          },
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
