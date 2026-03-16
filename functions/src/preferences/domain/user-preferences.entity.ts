export interface DashboardLayout {
  widgets: string[];
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
        widgets: ['anomalies', 'stats', 'insights', 'breakdown', 'tags', 'transactions'],
      },
      updatedAt: new Date(),
    });
  }
}
