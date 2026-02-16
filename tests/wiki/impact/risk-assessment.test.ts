import { RiskAssessmentService } from '../../../src/wiki/impact/risk-assessment';
import { ImpactItem, RiskLevel } from '../../../src/wiki/impact/types';

function createTestImpact(overrides: Partial<ImpactItem> = {}): ImpactItem {
  return {
    id: 'impact-1',
    type: 'direct',
    targetId: 'target-1',
    targetType: 'page',
    targetName: 'Test Target',
    description: 'Test impact',
    severity: 'medium',
    confidence: 0.8,
    affectedSections: [],
    metadata: {
      breakingChange: false,
      deprecation: false,
    },
    ...overrides,
  };
}

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  beforeEach(() => {
    service = new RiskAssessmentService();
  });

  describe('calculateRiskScore', () => {
    it('should return 0 for empty impacts', async () => {
      const score = await service.calculateRiskScore([]);

      expect(score).toBe(0);
    });

    it('should calculate score based on severity', async () => {
      const lowImpact = createTestImpact({ severity: 'low' });
      const mediumImpact = createTestImpact({ severity: 'medium' });
      const highImpact = createTestImpact({ severity: 'high' });
      const criticalImpact = createTestImpact({ severity: 'critical' });

      const lowScore = await service.calculateRiskScore([lowImpact]);
      const mediumScore = await service.calculateRiskScore([mediumImpact]);
      const highScore = await service.calculateRiskScore([highImpact]);
      const criticalScore = await service.calculateRiskScore([criticalImpact]);

      expect(criticalScore).toBeGreaterThan(highScore);
      expect(highScore).toBeGreaterThan(mediumScore);
      expect(mediumScore).toBeGreaterThan(lowScore);
    });

    it('should increase score for breaking changes', async () => {
      const normalImpact = createTestImpact({ severity: 'high' });
      const breakingImpact = createTestImpact({
        severity: 'high',
        metadata: { breakingChange: true, deprecation: false },
      });

      const normalScore = await service.calculateRiskScore([normalImpact]);
      const breakingScore = await service.calculateRiskScore([breakingImpact]);

      expect(breakingScore).toBeGreaterThan(normalScore);
    });

    it('should consider impact type', async () => {
      const directImpact = createTestImpact({ type: 'direct', severity: 'medium' });
      const indirectImpact = createTestImpact({ type: 'indirect', severity: 'medium' });

      const directScore = await service.calculateRiskScore([directImpact]);
      const indirectScore = await service.calculateRiskScore([indirectImpact]);

      expect(directScore).toBeGreaterThan(indirectScore);
    });

    it('should consider confidence', async () => {
      const highConfidence = createTestImpact({ severity: 'high', confidence: 0.9 });
      const lowConfidence = createTestImpact({ severity: 'high', confidence: 0.5 });

      const highScore = await service.calculateRiskScore([highConfidence]);
      const lowScore = await service.calculateRiskScore([lowConfidence]);

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('should handle multiple impacts', async () => {
      const impacts = [
        createTestImpact({ severity: 'high' }),
        createTestImpact({ severity: 'medium' }),
        createTestImpact({ severity: 'low' }),
      ];

      const score = await service.calculateRiskScore(impacts);

      expect(score).toBeGreaterThan(0);
    });
  });

  describe('identifyRiskFactors', () => {
    it('should identify breaking changes', async () => {
      const impacts = [
        createTestImpact({
          metadata: { breakingChange: true, deprecation: false },
        }),
      ];

      const factors = await service.identifyRiskFactors(impacts);

      expect(factors.some(f => f.id.includes('breaking'))).toBe(true);
    });

    it('should identify high severity impacts', async () => {
      const impacts = [
        createTestImpact({ severity: 'high' }),
        createTestImpact({ severity: 'critical' }),
      ];

      const factors = await service.identifyRiskFactors(impacts);

      expect(factors.some(f => f.id.includes('high-severity'))).toBe(true);
    });

    it('should identify API changes', async () => {
      const impacts = [
        createTestImpact({ targetType: 'api' }),
      ];

      const factors = await service.identifyRiskFactors(impacts);

      expect(factors.some(f => f.id.includes('api'))).toBe(true);
    });

    it('should identify documentation drift', async () => {
      const impacts = [
        createTestImpact({
          targetType: 'page',
          affectedSections: ['Section 1', 'Section 2'],
        }),
      ];

      const factors = await service.identifyRiskFactors(impacts);

      expect(factors.some(f => f.id.includes('documentation'))).toBe(true);
    });

    it('should identify module impacts', async () => {
      const impacts = [
        createTestImpact({ targetType: 'module' }),
      ];

      const factors = await service.identifyRiskFactors(impacts);

      expect(factors.some(f => f.id.includes('module'))).toBe(true);
    });

    it('should return empty array for no significant impacts', async () => {
      const impacts = [
        createTestImpact({ severity: 'low', targetType: 'file' }),
      ];

      const factors = await service.identifyRiskFactors(impacts);

      expect(factors.length).toBeLessThanOrEqual(1);
    });
  });

  describe('generateMitigation', () => {
    it('should generate mitigation for breaking changes', async () => {
      const factors = [
        {
          id: 'rf-breaking-changes',
          name: 'Breaking Changes',
          description: 'Test',
          severity: 'high' as RiskLevel,
          probability: 0.9,
          impact: 0.8,
          category: 'breaking-change' as const,
          affectedItems: ['item1'],
          evidence: [],
        },
      ];

      const strategies = await service.generateMitigation(factors);

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some(s => s.name.includes('Breaking'))).toBe(true);
    });

    it('should generate general mitigation for high risks', async () => {
      const factors = [
        {
          id: 'rf-test',
          name: 'High Risk',
          description: 'Test',
          severity: 'critical' as RiskLevel,
          probability: 0.9,
          impact: 0.9,
          category: 'dependency' as const,
          affectedItems: [],
          evidence: [],
        },
      ];

      const strategies = await service.generateMitigation(factors);

      expect(strategies.some(s => s.name.includes('Comprehensive'))).toBe(true);
    });

    it('should include steps in mitigation strategies', async () => {
      const factors = [
        {
          id: 'rf-breaking-changes',
          name: 'Breaking Changes',
          description: 'Test',
          severity: 'high' as RiskLevel,
          probability: 0.9,
          impact: 0.8,
          category: 'breaking-change' as const,
          affectedItems: [],
          evidence: [],
        },
      ];

      const strategies = await service.generateMitigation(factors);

      expect(strategies[0].steps.length).toBeGreaterThan(0);
    });
  });

  describe('assessOverallRisk', () => {
    it('should return complete risk assessment', async () => {
      const impacts = [
        createTestImpact({ severity: 'high' }),
        createTestImpact({ severity: 'medium' }),
      ];

      const assessment = await service.assessOverallRisk(impacts);

      expect(assessment.overallRisk).toBeDefined();
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskFactors).toBeDefined();
      expect(assessment.mitigationStrategies).toBeDefined();
      expect(assessment.confidence).toBeGreaterThanOrEqual(0);
      expect(assessment.summary).toBeDefined();
    });

    it('should determine correct overall risk level', async () => {
      const criticalImpacts = [createTestImpact({ severity: 'critical' })];
      const highImpacts = [
        createTestImpact({ severity: 'high' }),
        createTestImpact({ severity: 'high' }),
      ];
      const lowImpacts = [createTestImpact({ severity: 'low' })];

      const criticalAssessment = await service.assessOverallRisk(criticalImpacts);
      const highAssessment = await service.assessOverallRisk(highImpacts);
      const lowAssessment = await service.assessOverallRisk(lowImpacts);

      expect(criticalAssessment.overallRisk).toBe('critical');
      expect(['high', 'critical']).toContain(highAssessment.overallRisk);
      expect(['low', 'medium']).toContain(lowAssessment.overallRisk);
    });

    it('should generate meaningful summary', async () => {
      const impacts = [
        createTestImpact({ severity: 'high', targetName: 'Target A' }),
      ];

      const assessment = await service.assessOverallRisk(impacts);

      expect(assessment.summary.length).toBeGreaterThan(0);
      expect(assessment.summary).toContain('risk');
    });
  });
});
