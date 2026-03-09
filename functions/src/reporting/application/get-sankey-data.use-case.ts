import { Injectable } from '@nestjs/common';
import { GetBudgetBreakdownUseCase } from './get-budget-breakdown.use-case';
import { GetPeriodStatsUseCase } from './get-period-stats.use-case';

export interface SankeyNode {
  id: string;
  name: string;
  color?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyDataResponse {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

@Injectable()
export class GetSankeyDataUseCase {
  constructor(
    private readonly getBudgetBreakdownUseCase: GetBudgetBreakdownUseCase,
    private readonly getPeriodStatsUseCase: GetPeriodStatsUseCase,
  ) {}

  async execute(accountId: string, periodId: string): Promise<SankeyDataResponse> {
    const breakdown = await this.getBudgetBreakdownUseCase.execute(accountId, periodId);
    
    const nodes: SankeyNode[] = [
      { id: 'income', name: 'Revenus', color: '#10b981' },
      { id: 'wallet', name: 'Compte', color: '#6366f1' },
      { id: 'expenses', name: 'Dépenses', color: '#ef4444' },
      { id: 'savings', name: 'Épargne', color: '#3b82f6' },
      { id: 'transfers', name: 'Virements', color: '#8b5cf6' },
    ];

    const links: any[] = []; // Temporary links with IDs

    const addIncomeLinks = (items: any[]) => {
      for (const item of items) {
        const val = Math.abs(Number(item.real) / 100);
        if (val > 0) {
          const nodeId = `cat-${item.categoryId}`;
          nodes.push({ id: nodeId, name: item.name });
          links.push({ source: nodeId, target: 'income', value: val });
        }
      }
    };

    addIncomeLinks(breakdown.income);
    
    let totalIncome = breakdown.income.reduce((sum, i) => sum + Math.abs(Number(i.real)), 0) / 100;
    if (totalIncome > 0) {
      links.push({ source: 'income', target: 'wallet', value: totalIncome });
    }

    const expVal = Math.abs(Number(breakdown.expenses.reduce((sum, i) => sum + BigInt(i.real), BigInt(0))) / 100);
    const savVal = Math.abs(Number(breakdown.savings.reduce((sum, i) => sum + BigInt(i.real), BigInt(0))) / 100);
    const traVal = Math.abs(Number(breakdown.transfers.reduce((sum, i) => sum + BigInt(i.real), BigInt(0))) / 100);

    if (expVal > 0) links.push({ source: 'wallet', target: 'expenses', value: expVal });
    if (savVal > 0) links.push({ source: 'wallet', target: 'savings', value: savVal });
    if (traVal > 0) links.push({ source: 'wallet', target: 'transfers', value: traVal });

    const addGroupLinks = (group: any[], sourceId: string) => {
      for (const item of group) {
        const val = Math.abs(Number(item.real) / 100);
        if (val > 0) {
          const nodeId = `cat-${item.categoryId}`;
          nodes.push({ id: nodeId, name: item.name });
          links.push({ source: sourceId, target: nodeId, value: val });
        }
      }
    };

    addGroupLinks(breakdown.expenses, 'expenses');
    addGroupLinks(breakdown.savings, 'savings');
    addGroupLinks(breakdown.transfers, 'transfers');

    // Convert links from ID to index
    const indexedLinks: SankeyLink[] = links.map(l => ({
      source: nodes.findIndex(n => n.id === l.source),
      target: nodes.findIndex(n => n.id === l.target),
      value: l.value
    })).filter(l => l.source !== -1 && l.target !== -1);

    return { 
      nodes: nodes.map(({ id, ...rest }) => rest), // Recharts only needs name (and color for custom render)
      links: indexedLinks 
    };
  }
}
