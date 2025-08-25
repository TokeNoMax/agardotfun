import React, { useState, useEffect } from 'react';
import { gameplayValidator } from '@/services/security/gameplayValidator';
import { serverValidator } from '@/services/security/serverValidator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Users, Activity } from 'lucide-react';

interface SecurityDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ isOpen, onClose }) => {
  const [securityReport, setSecurityReport] = useState<any>(null);
  const [validationStats, setValidationStats] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    const updateStats = () => {
      const report = gameplayValidator.getSecurityReport();
      const stats = serverValidator.getValidationStats();
      setSecurityReport(report);
      setValidationStats(stats);
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Tableau de Sécurité</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {/* Risk Level Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Niveau de Risque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`px-3 py-2 rounded-lg border text-center font-medium ${
                  getRiskColor(securityReport?.riskLevel || 'low')
                }`}>
                  {securityReport?.riskLevel?.toUpperCase() || 'LOW'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Joueurs Surveillés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-center">
                  {securityReport?.playerStats?.size || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Violations Récentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-center text-red-400">
                  {securityReport?.violations?.length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Validation Statistics */}
          {validationStats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Statistiques de Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Validations</div>
                    <div className="font-medium">{validationStats.totalValidations}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Échecs</div>
                    <div className="font-medium text-red-400">{validationStats.failedValidations}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Mode Strict</div>
                    <div className="font-medium">
                      {validationStats.config?.strictMode ? 'Activé' : 'Désactivé'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Validation Input</div>
                    <div className="font-medium">
                      {validationStats.config?.enableInputValidation ? 'Activé' : 'Désactivé'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Violations */}
          {securityReport?.violations && securityReport.violations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Violations Récentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {securityReport.violations.map((violation: any, index: number) => (
                    <div key={index} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getSeverityColor(violation.severity) as any}>
                            {violation.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {violation.type.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {violation.description}
                        </div>
                        {violation.data && (
                          <div className="text-xs text-muted-foreground mt-1 font-mono">
                            {JSON.stringify(violation.data, null, 2).slice(0, 100)}...
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(violation.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Player Statistics */}
          {securityReport?.playerStats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Statistiques des Joueurs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {Array.from(securityReport.playerStats.entries()).map(([playerId, stats]: [string, any]) => (
                    <div key={playerId} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                      <div className="text-sm font-mono">{playerId.slice(0, 8)}...</div>
                      <div className="text-xs text-muted-foreground">
                        Pos: ({stats.position?.x?.toFixed(0)}, {stats.position?.y?.toFixed(0)}) | 
                        Taille: {stats.size?.toFixed(1)} | 
                        Violations: {stats.violations}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Configuration de Sécurité</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span>Validation Position</span>
                  <Badge variant={validationStats?.config?.enablePositionValidation ? 'default' : 'secondary'}>
                    {validationStats?.config?.enablePositionValidation ? 'ON' : 'OFF'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Validation Collision</span>
                  <Badge variant={validationStats?.config?.enableCollisionValidation ? 'default' : 'secondary'}>
                    {validationStats?.config?.enableCollisionValidation ? 'ON' : 'OFF'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Validation Taille</span>
                  <Badge variant={validationStats?.config?.enableSizeValidation ? 'default' : 'secondary'}>
                    {validationStats?.config?.enableSizeValidation ? 'ON' : 'OFF'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Mode Strict</span>
                  <Badge variant={validationStats?.config?.strictMode ? 'destructive' : 'secondary'}>
                    {validationStats?.config?.strictMode ? 'ON' : 'OFF'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;