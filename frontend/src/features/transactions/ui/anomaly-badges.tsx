import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AnomalyMark } from '../model/anomaly-marks';

/** Marques « Doublon possible » / « Dépense inhabituelle » d'une ligne. */
export function AnomalyBadges({ marks, t }: { marks?: AnomalyMark[]; t: (key: string) => string }) {
  if (!marks || marks.length === 0) return null;
  return (
    <>
      {marks.map((mark) => (
        <Badge
          key={mark}
          variant="outline"
          data-testid={`anomaly-${mark}`}
          className="h-5 gap-1 px-1.5 text-[10px] max-lg:text-xs py-0 border-orange-500/40 text-orange-700 dark:text-orange-400"
        >
          <AlertTriangle className="w-3 h-3" />
          {t(mark === 'duplicate' ? 'anomaly.duplicate' : 'anomaly.outlier')}
        </Badge>
      ))}
    </>
  );
}
