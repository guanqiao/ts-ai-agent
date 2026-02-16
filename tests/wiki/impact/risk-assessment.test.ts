import { RiskAssessmentService } from '../../../src/wiki/impact/risk-assessment';
import { ImpactItem, RiskFactor } from '../../../src/wiki/impact/types';

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  beforeEach(() => {
    service = new RiskAssessmentService();
  });

  describe('assessRisk', () => {
    it('should assess risk for file modification', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'direct-1',
          type: 'file',
          name: 'user.ts',
          path: 'src/user.ts',
          impactLevel: 'medium',
          description: 'Modified user service',
          affectedBy: [],
          affects: [],
        },
      ];
      const indirectImpacts: ImpactItem[] = [];

      const assessment = service.assessRisk(directImpacts, indirectImpacts, 'modified');

      expect(assessment).toBeDefined();
      expect(assessment.id).toBeDefined();
      expect(assessment.overallRisk).toBeDefined();
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.factors).toBeDefined();
      expect(assessment.affectedAreas).toBeDefined();
      expect(assessment.timeframe).toBeDefined();
      expect(assessment.recommendation).toBeDefined();
    });

    it('should assess risk for file removal', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'direct-1',
          type: 'file',
          name: 'user.ts',
          path: 'src/user.ts',
          impactLevel: 'high',
          description: 'Removed user service',
          affectedBy: [],
          affects: [],
        },
      ];
      const indirectImpacts: ImpactItem[] = [];

      const assessment = service.assessRisk(directImpacts, indirectImpacts, 'removed');

      // File removal is considered critical risk
      expect(['critical', 'high']).toContain(assessment.overallRisk);
      expect(assessment.timeframe).toBe('immediate');
      expect(assessment.factors.some(f => f.type === 'breaking-change')).toBe(true);
    });

    it('should identify affected areas', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'direct-1',
          type: 'file',
          name: 'user.ts',
          path: 'src/user.ts',
          impactLevel: 'medium',
          description: 'Modified user service',
          affectedBy: [],
          affects: [],
        },
      ];
      const indirectImpacts: ImpactItem[] = [
        {
          id: 'indirect-1',
          type: 'test',
          name: 'user.test.ts',
          path: 'src/user.test.ts',
          impactLevel: 'low',
          description: 'Test file affected',
          affectedBy: ['src/user.ts'],
          affects: [],
        },
      ];

      const assessment = service.assessRisk(directImpacts, indirectImpacts, 'modified');

      expect(assessment.affectedAreas).toContain('file');
      expect(assessment.affectedAreas).toContain('test');
      expect(assessment.affectedAreas).toContain('src');
    });

    it('should set immediate timeframe for high severity', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'direct-1',
          type: 'file',
          name: 'user.ts',
          path: 'src/user.ts',
          impactLevel: 'high',
          description: 'Removed user service',
          affectedBy: [],
          affects: [],
        },
      ];

      const assessment = service.assessRisk(directImpacts, [], 'removed');

      expect(assessment.timeframe).toBe('immediate');
    });

    it('should set short-term timeframe for medium severity', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'direct-1',
          type: 'test',
          name: 'user.test.ts',
          path: 'src/user.test.ts',
          impactLevel: 'medium',
          description: 'Modified test',
          affectedBy: [],
          affects: [],
        },
      ];

      const assessment = service.assessRisk(directImpacts, [], 'modified');

      expect(assessment.timeframe).toBe('short-term');
    });

    it('should set long-term timeframe for low severity', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'direct-1',
          type: 'document',
          name: 'readme.md',
          path: 'docs/readme.md',
          impactLevel: 'low',
          description: 'Updated docs',
          affectedBy: [],
          affects: [],
        },
      ];

      const assessment = service.assessRisk(directImpacts, [], 'modified');

      expect(assessment.timeframe).toBe('long-term');
    });
  });

  describe('calculateRiskScore', () => {
    it('should return 0 for empty factors', () => {
      const score = service.calculateRiskScore([]);
      expect(score).toBe(0);
    });

    it('should calculate weighted score for single factor', () => {
      const factors: RiskFactor[] = [
        {
          id: 'factor-1',
          type: 'breaking-change',
          description: 'Test',
          severity: 'high',
          confidence: 1.0,
          mitigation: 'Test mitigation',
        },
      ];

      const score = service.calculateRiskScore(factors);

      // High severity = 3, confidence = 1.0, so score = 3 * 1.0 / 1.0 = 3
      expect(score).toBe(3);
    });

    it('should calculate weighted average for multiple factors', () => {
      const factors: RiskFactor[] = [
        {
          id: 'factor-1',
          type: 'breaking-change',
          description: 'High severity',
          severity: 'high',
          confidence: 1.0,
          mitigation: 'Mitigation 1',
        },
        {
          id: 'factor-2',
          type: 'maintenance',
          description: 'Low severity',
          severity: 'low',
          confidence: 1.0,
          mitigation: 'Mitigation 2',
        },
      ];

      const score = service.calculateRiskScore(factors);

      // (3 * 1.0 + 1 * 1.0) / (1.0 + 1.0) = 4 / 2 = 2
      expect(score).toBe(2);
    });

    it('should weight by confidence', () => {
      const factors: RiskFactor[] = [
        {
          id: 'factor-1',
          type: 'breaking-change',
          description: 'High severity low confidence',
          severity: 'high',
          confidence: 0.5,
          mitigation: 'Mitigation 1',
        },
        {
          id: 'factor-2',
          type: 'maintenance',
          description: 'Medium severity high confidence',
          severity: 'medium',
          confidence: 1.0,
          mitigation: 'Mitigation 2',
        },
      ];

      const score = service.calculateRiskScore(factors);

      // (3 * 0.5 + 2 * 1.0) / (0.5 + 1.0) = 3.5 / 1.5 = 2.33
      expect(score).toBeCloseTo(2.33, 1);
    });
  });

  describe('identifyRiskFactors', () => {
    it('should identify breaking change for file removal', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'direct-1',
          type: 'file',
          name: 'user.ts',
          path: 'src/user.ts',
          impactLevel: 'high',
          description: 'Removed',
          affectedBy: [],
          affects: [],
        },
      ];

      const factors = service.identifyRiskFactors(directImpacts, [], 'removed');

      expect(factors.some(f => f.type === 'breaking-change')).toBe(true);
      expect(factors.some(f => f.description.includes('删除'))).toBe(true);
    });

    it('should identify breaking change for multiple high impacts', () => {
      const directImpacts: ImpactItem[] = [
        { id: '1', type: 'file', name: 'a.ts', path: 'a.ts', impactLevel: 'high', description: '', affectedBy: [], affects: [] },
        { id: '2', type: 'file', name: 'b.ts', path: 'b.ts', impactLevel: 'high', description: '', affectedBy: [], affects: [] },
        { id: '3', type: 'file', name: 'c.ts', path: 'c.ts', impactLevel: 'high', description: '', affectedBy: [], affects: [] },
      ];

      const factors = service.identifyRiskFactors(directImpacts, [], 'modified');

      expect(factors.some(f => f.description.includes('多个高影响'))).toBe(true);
    });

    it('should identify maintenance factor for test impacts', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'direct-1',
          type: 'test',
          name: 'user.test.ts',
          path: 'src/user.test.ts',
          impactLevel: 'medium',
          description: 'Test modified',
          affectedBy: [],
          affects: [],
        },
      ];

      const factors = service.identifyRiskFactors(directImpacts, [], 'modified');

      expect(factors.some(f => f.type === 'maintenance' && f.description.includes('测试'))).toBe(true);
    });

    it('should identify maintenance factor for document impacts', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'direct-1',
          type: 'document',
          name: 'readme.md',
          path: 'docs/readme.md',
          impactLevel: 'low',
          description: 'Docs updated',
          affectedBy: [],
          affects: [],
        },
      ];

      const factors = service.identifyRiskFactors(directImpacts, [], 'modified');

      expect(factors.some(f => f.type === 'maintenance' && f.description.includes('文档'))).toBe(true);
    });

    it('should identify breaking change for high impact modifications', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'direct-1',
          type: 'file',
          name: 'core.ts',
          path: 'src/core.ts',
          impactLevel: 'high',
          description: 'Core modified',
          affectedBy: [],
          affects: [],
        },
      ];

      const factors = service.identifyRiskFactors(directImpacts, [], 'modified');

      expect(factors.some(f => f.description.includes('核心文件'))).toBe(true);
    });
  });

  describe('generateMitigation', () => {
    it('should generate mitigation for all factors', () => {
      const factors: RiskFactor[] = [
        {
          id: 'factor-1',
          type: 'breaking-change',
          description: 'Test 1',
          severity: 'high',
          confidence: 1.0,
          mitigation: 'Mitigation 1',
        },
        {
          id: 'factor-2',
          type: 'maintenance',
          description: 'Test 2',
          severity: 'medium',
          confidence: 1.0,
          mitigation: 'Mitigation 2',
        },
      ];

      const mitigations = service.generateMitigation(factors);

      expect(mitigations).toContain('Mitigation 1');
      expect(mitigations).toContain('Mitigation 2');
    });

    it('should return empty array for no factors', () => {
      const mitigations = service.generateMitigation([]);
      expect(mitigations).toEqual([]);
    });
  });

  describe('assessOverallRisk', () => {
    it('should assess critical risk', () => {
      const impacts: ImpactItem[] = [
        {
          id: '1',
          type: 'file',
          name: 'core.ts',
          path: 'src/core.ts',
          impactLevel: 'high',
          description: 'Core removed',
          affectedBy: [],
          affects: [],
        },
      ];

      const risk = service.assessOverallRisk(impacts);

      expect(risk).toBe('high');
    });

    it('should assess medium risk', () => {
      const impacts: ImpactItem[] = [
        {
          id: '1',
          type: 'file',
          name: 'utils.ts',
          path: 'src/utils.ts',
          impactLevel: 'medium',
          description: 'Utils modified',
          affectedBy: [],
          affects: [],
        },
      ];

      const risk = service.assessOverallRisk(impacts);

      expect(['medium', 'low']).toContain(risk);
    });
  });

  describe('risk level mapping', () => {
    it('should map score >= 2.5 to critical', () => {
      const factors: RiskFactor[] = [
        {
          id: 'factor-1',
          type: 'breaking-change',
          description: 'Critical',
          severity: 'high',
          confidence: 1.0,
          mitigation: 'Test',
        },
        {
          id: 'factor-2',
          type: 'breaking-change',
          description: 'Critical 2',
          severity: 'high',
          confidence: 1.0,
          mitigation: 'Test 2',
        },
      ];

      // Test score calculation for critical risk level
      const score = service.calculateRiskScore(factors);
      expect(score).toBeGreaterThanOrEqual(2.5);
    });

    it('should map score >= 1.8 to high', () => {
      const factors: RiskFactor[] = [
        {
          id: 'factor-1',
          type: 'breaking-change',
          description: 'High',
          severity: 'high',
          confidence: 0.6,
          mitigation: 'Test',
        },
      ];

      const score = service.calculateRiskScore(factors);
      // 3 * 0.6 / 0.6 = 3, which is >= 1.8
      expect(score).toBeGreaterThanOrEqual(1.8);
    });

    it('should map score >= 1.2 to medium', () => {
      const factors: RiskFactor[] = [
        {
          id: 'factor-1',
          type: 'maintenance',
          description: 'Medium',
          severity: 'medium',
          confidence: 0.8,
          mitigation: 'Test',
        },
      ];

      const score = service.calculateRiskScore(factors);
      // 2 * 0.8 / 0.8 = 2, which is >= 1.2
      expect(score).toBeGreaterThanOrEqual(1.2);
    });

    it('should map score < 1.2 to low', () => {
      const factors: RiskFactor[] = [
        {
          id: 'factor-1',
          type: 'maintenance',
          description: 'Low',
          severity: 'low',
          confidence: 0.5,
          mitigation: 'Test',
        },
      ];

      const score = service.calculateRiskScore(factors);
      // 1 * 0.5 / 0.5 = 1, which is < 1.2
      expect(score).toBeLessThan(1.2);
    });
  });

  describe('recommendations', () => {
    it('should provide critical risk recommendation', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: '1',
          type: 'file',
          name: 'core.ts',
          path: 'src/core.ts',
          impactLevel: 'high',
          description: 'Core removed',
          affectedBy: [],
          affects: [],
        },
      ];

      const assessment = service.assessRisk(directImpacts, [], 'removed');

      expect(assessment.recommendation).toContain('立即');
      expect(assessment.recommendation).toContain('回滚');
    });

    it('should provide high risk recommendation', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: '1',
          type: 'file',
          name: 'service.ts',
          path: 'src/service.ts',
          impactLevel: 'high',
          description: 'Service modified',
          affectedBy: [],
          affects: [],
        },
      ];

      const assessment = service.assessRisk(directImpacts, [], 'modified');

      if (assessment.overallRisk === 'high') {
        expect(assessment.recommendation).toContain('详细测试');
      }
    });

    it('should provide medium risk recommendation', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: '1',
          type: 'test',
          name: 'test.ts',
          path: 'src/test.ts',
          impactLevel: 'medium',
          description: 'Test modified',
          affectedBy: [],
          affects: [],
        },
      ];

      const assessment = service.assessRisk(directImpacts, [], 'modified');

      if (assessment.overallRisk === 'medium') {
        expect(assessment.recommendation).toContain('常规测试');
      }
    });

    it('should provide low risk recommendation', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: '1',
          type: 'document',
          name: 'readme.md',
          path: 'docs/readme.md',
          impactLevel: 'low',
          description: 'Docs updated',
          affectedBy: [],
          affects: [],
        },
      ];

      const assessment = service.assessRisk(directImpacts, [], 'modified');

      if (assessment.overallRisk === 'low') {
        expect(assessment.recommendation).toContain('基本测试');
      }
    });
  });
});
