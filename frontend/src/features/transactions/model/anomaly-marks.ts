import { Anomaly } from '@/features/reporting/model/types';

export type AnomalyMark = Anomaly['type'];

/**
 * Marques « Doublon possible » / « Dépense inhabituelle » par transaction, d'après les anomalies de la période
 * (les anomalies ignorées n'y sont plus). Aucune règle de détection ici.
 */
export function anomalyMarks(anomalies: Anomaly[] | undefined): Record<string, AnomalyMark[]> {
  const marks: Record<string, AnomalyMark[]> = {};
  for (const anomaly of anomalies ?? []) {
    for (const id of anomaly.transactionIds) {
      const list = (marks[id] ??= []);
      if (!list.includes(anomaly.type)) list.push(anomaly.type);
    }
  }
  return marks;
}
