import { RiskAssessmentService } from '../../../src/wiki/impact/risk-assessment';
import { ImpactItem, RiskFactor } from '../../../src/wiki/impact/types';

function createTestImpact(overrides: Partial<ImpactItem> = {}): ImpactItem {
  return {
    id: 'impact-1',
    type: 'file',
    name: 'Test File',
    path: 'src/test.ts',
    impactLevel: 'medium',
    description: 'Test impact',
    affectedBy: [],
    affects: [],
    ...overrides,
  };
}

function createTestRiskFactor(overrides: Partial<RiskFactor> = {}): RiskFactor {
  return {
    id: 'factor-1',
    type: 'breaking-change',
    description: 'Test risk factor',
    severity: 'medium',
    confidence: 0.8,
    mitigation: 'Test mitigation',
    ...overrides,
  };
}

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  beforeEach(() => {
    service = new RiskAssessmentService();
  });

  describe('calculateRiskScore', () => {
    it('should return 0 for empty factors', () => {
      const score = service.calculateRiskScore([]);

      expect(score).toBe(0);
    });

    it('should calculate score based on severity', () => {
      const lowFactor = createTestRiskFactor({ severity: 'low' });
      const mediumFactor = createTestRiskFactor({ severity: 'medium' });
      const highFactor = createTestRiskFactor({ severity: 'high' });

      const lowScore = service.calculateRiskScore([lowFactor]);
      const mediumScore = service.calculateRiskScore([mediumFactor]);
      const highScore = service.calculateRiskScore([highFactor]);

      expect(highScore).toBeGreaterThan(mediumScore);
      expect(mediumScore).toBeGreaterThan(lowScore);
    });

    it('should consider confidence', () => {
      const highConfidence = createTestRiskFactor({ severity: 'high', confidence: 0.9 });
      const lowConfidence = createTestRiskFactor({ severity: 'high', confidence: 0.5 });

      const highScore = service.calculateRiskScore([highConfidence]);
      const lowScore = service.calculateRiskScore([lowConfidence]);

      expect(highScore).toBeGreaterThanOrEqual(lowScore);
    });

    it('should handle multiple factors', () => {
      const factors = [
        createTestRiskFactor({ severity: 'high' }),
        createTestRiskFactor({ severity: 'medium' }),
        createTestRiskFactor({ severity: 'low' }),
      ];

      const score = service.calculateRiskScore(factors);

      expect(score).toBeGreaterThan(0);
    });

    it('should weight high severity factors more', () => {
      const allLow = [
        createTestRiskFactor({ severity: 'low' }),
        createTestRiskFactor({ severity: 'low' }),
      ];
      const oneHigh = [createTestRiskFactor({ severity: 'high' })];

      const lowScore = service.calculateRiskScore(allLow);
      const highScore = service.calculateRiskScore(oneHigh);

      expect(highScore).toBeGreaterThan(lowScore);
    });
  });

  describe('identifyRiskFactors', () => {
    it('should identify risk factors for removed files', () => {
      const directImpacts = [createTestImpact({ impactLevel: 'high' })];
      const indirectImpacts: ImpactItem[] = [];

      const factors = service.identifyRiskFactors(directImpacts, indirectImpacts, 'removed');

      expect(factors.length).toBeGreaterThan(0);
      expect(factors.some(f => f.type === 'breaking-change')).toBe(true);
    });

    it('should identify risk factors for multiple high impacts', () => {
      const directImpacts = [
        createTestImpact({ impactLevel: 'high' }),
        createTestImpact({ impactLevel: 'high' }),
        createTestImpact({ impactLevel: 'high' }),
      ];
      const indirectImpacts: ImpactItem[] = [];

      const factors = service.identifyRiskFactors(directImpacts, indirectImpacts, 'modified');

      expect(factors.some(f => f.description.includes('高影响'))).toBe(true);
    });

    it('should identify test impacts', () => {
      const directImpacts = [createTestImpact({ type: 'test' })];
      const indirectImpacts: ImpactItem[] = [];

      const factors = service.identifyRiskFactors(directImpacts, indirectImpacts, 'modified');

      expect(factors.some(f => f.description.includes('测试'))).toBe(true);
    });

    it('should identify document impacts', () => {
      const directImpacts = [createTestImpact({ type: 'document' })];
      const indirectImpacts: ImpactItem[] = [];

      const factors = service.identifyRiskFactors(directImpacts, indirectImpacts, 'modified');

      expect(factors.some(f => f.description.includes('文档'))).toBe(true);
    });

    it('should identify high impact modifications', () => {
      const directImpacts = [createTestImpact({ impactLevel: 'high' })];
      const indirectImpacts: ImpactItem[] = [];

      const factors = service.identifyRiskFactors(directImpacts, indirectImpacts, 'modified');

      expect(factors.some(f => f.description.includes('核心'))).toBe(true);
    });

    it('should return empty array for low impact changes', () => {
      const directImpacts = [createTestImpact({ impactLevel: 'low', type: 'file' })];
      const indirectImpacts: ImpactItem[] = [];

      const factors = service.identifyRiskFactors(directImpacts, indirectImpacts, 'added');

      expect(factors.length).toBe(0);
    });
  });

  describe('generateMitigation', () => {
    it('should generate mitigation strings from factors', () => {
      const factors = [
        createTestRiskFactor({ mitigation: 'Update tests' }),
        createTestRiskFactor({ mitigation: 'Update documentation' }),
      ];

      const strategies = service.generateMitigation(factors);

      expect(strategies.length).toBe(2);
      expect(strategies).toContain('Update tests');
      expect(strategies).toContain('Update documentation');
    });

    it('should return empty array for no factors', () => {
      const strategies = service.generateMitigation([]);

      expect(strategies).toHaveLength(0);
    });
  });

  describe('assessRisk', () => {
    it('should return complete risk assessment', () => {
      const directImpacts = [createTestImpact({ impactLevel: 'high' })];
      const indirectImpacts = [createTestImpact({ impactLevel: 'medium' })];

      const assessment = service.assessRisk(directImpacts, indirectImpacts, 'modified');

      expect(assessment.overallRisk).toBeDefined();
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.factors).toBeDefined();
      expect(assessment.affectedAreas).toBeDefined();
      expect(assessment.timeframe).toBeDefined();
      expect(assessment.recommendation).toBeDefined();
    });

    it('should determine correct overall risk level for critical changes', () => {
      const directImpacts = [
        createTestImpact({ impactLevel: 'high' }),
        createTestImpact({ impactLevel: 'high' }),
        createTestImpact({ impactLevel: 'high' }),
      ];

      const assessment = service.assessRisk(directImpacts, [], 'removed');

      expect(['high', 'critical']).toContain(assessment.overallRisk);
    });

    it('should determine correct overall risk level for low changes', () => {
      const directImpacts = [createTestImpact({ impactLevel: 'low' })];

      const assessment = service.assessRisk(directImpacts, [], 'added');

      expect(['low', 'medium']).toContain(assessment.overallRisk);
    });

    it('should set immediate timeframe for removed files', () => {
      const assessment = service.assessRisk([], [], 'removed');

      expect(assessment.timeframe).toBe('immediate');
    });

    it('should identify affected areas', () => {
      const directImpacts = [
        createTestImpact({ path: 'src/components/Button.tsx', type: 'function' }),
        createTestImpact({ path: 'src/utils/helpers.ts', type: 'class' }),
      ];

      const assessment = service.assessRisk(directImpacts, [], 'modified');

      expect(assessment.affectedAreas.length).toBeGreaterThan(0);
      expect(assessment.affectedAreas).toContain('function');
      expect(assessment.affectedAreas).toContain('class');
    });

    it('should generate appropriate recommendation for critical risk', () => {
      const directImpacts = Array(5).fill(null).map(() => createTestImpact({ impactLevel: 'high' }));

      const assessment = service.assessRisk(directImpacts, [], 'removed');

      expect(assessment.recommendation.length).toBeGreaterThan(0);
    });
  });

  describe('assessOverallRisk', () => {
    it('should return risk level for impacts', () => {
      const impacts = [
        createTestImpact({ impactLevel: 'high' }),
        createTestImpact({ impactLevel: 'medium' }),
      ];

      const riskLevel = service.assessOverallRisk(impacts);

      expect(['low', 'medium', 'high', 'critical']).toContain(riskLevel);
    });

    it('should return low for minimal impacts', () => {
      const impacts = [createTestImpact({ impactLevel: 'low' })];

      const riskLevel = service.assessOverallRisk(impacts);

      expect(['low', 'medium']).toContain(riskLevel);
    });
  });
});
