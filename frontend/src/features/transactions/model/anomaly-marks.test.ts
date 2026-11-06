import { describe, expect, it } from 'vitest';
import { anomalyMarks } from './anomaly-marks';

const anomaly = (id: string, type: 'duplicate' | 'outlier', transactionIds: string[]) => ({
  id, type, severity: 'high' as const, description: '', transactionIds,
});

describe('marques d\'anomalie', () => {
  it('marque chaque transaction de l\'anomalie selon son type', () => {
    const marks = anomalyMarks([anomaly('1', 'duplicate', ['t1', 't2']), anomaly('2', 'outlier', ['t3'])]);
    expect(marks).toEqual({ t1: ['duplicate'], t2: ['duplicate'], t3: ['outlier'] });
  });

  it('cumule les deux marques sur une même transaction, sans doublon', () => {
    const marks = anomalyMarks([anomaly('1', 'duplicate', ['t1']), anomaly('2', 'outlier', ['t1']), anomaly('3', 'duplicate', ['t1'])]);
    expect(marks.t1).toEqual(['duplicate', 'outlier']);
  });

  it('ne marque rien sans anomalie (ignorée ou absente)', () => {
    expect(anomalyMarks([])).toEqual({});
    expect(anomalyMarks(undefined)).toEqual({});
  });
});
