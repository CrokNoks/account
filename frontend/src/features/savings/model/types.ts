export interface SavingsGoal {
  id: string;
  accountId: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavingsGoalData {
  accountId: string;
  data: Partial<SavingsGoal>;
}

export interface UpdateSavingsGoalData {
  accountId: string;
  id: string;
  data: Partial<SavingsGoal>;
}

export interface DeleteSavingsGoalData {
  accountId: string;
  id: string;
}
