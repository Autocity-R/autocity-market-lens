import { QualityAssessment } from '@/hooks/useValuation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  quality: QualityAssessment;
  risks: string[];
}

export function DataQualityAlert({ quality, risks }: Props) {
  const allWarnings = [...quality.warnings, ...risks];

  const getQualityIcon = () => {
    switch (quality.quality) {
      case 'excellent':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'good':
        return <Shield className="h-4 w-4 text-primary" />;
      case 'fair':
        return <Info className="h-4 w-4 text-warning" />;
      case 'limited':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const getQualityLabel = () => {
    switch (quality.quality) {
      case 'excellent':
        return 'Uitstekend';
      case 'good':
        return 'Goed';
      case 'fair':
        return 'Matig';
      case 'limited':
        return 'Beperkt';
    }
  };

  const getQualityVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (quality.quality) {
      case 'excellent':
        return 'default';
      case 'good':
        return 'default';
      case 'fair':
        return 'secondary';
      case 'limited':
        return 'destructive';
    }
  };

  const getAlertVariant = (): 'default' | 'destructive' => {
    return quality.quality === 'limited' ? 'destructive' : 'default';
  };

  if (allWarnings.length === 0 && quality.quality === 'excellent') {
    return null;
  }

  return (
    <Alert variant={getAlertVariant()} className="border-border">
      <div className="flex items-start gap-3">
        {getQualityIcon()}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTitle className="mb-0">Datakwaliteit</AlertTitle>
            <Badge variant={getQualityVariant()} className="text-xs">
              {getQualityLabel()}
            </Badge>
          </div>
          {allWarnings.length > 0 && (
            <AlertDescription className="mt-2">
              <ul className="list-disc list-inside space-y-1 text-sm">
                {allWarnings.slice(0, 5).map((warning, index) => (
                  <li key={index} className="text-muted-foreground">
                    {warning}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </div>
      </div>
    </Alert>
  );
}
