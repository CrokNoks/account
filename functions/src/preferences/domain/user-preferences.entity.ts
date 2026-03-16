export interface DashboardWidgetConfig {
  id: string;
  width: number; // 4, 6, or 12
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
          { id: 'anomalies', width: 12 },
          { id: 'stats', width: 12 },
          { id: 'insights', width: 12 },
          { id: 'breakdown', width: 6 },
          { id: 'tags', width: 6 },
          { id: 'transactions', width: 12 },
        ],
      },
      updatedAt: new Date(),
    });
  }
}
