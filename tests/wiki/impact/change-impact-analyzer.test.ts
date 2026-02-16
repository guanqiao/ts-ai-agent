import * as path from 'path';
import { ChangeImpactAnalyzer } from '../../../src/wiki/impact/change-impact-analyzer';
import { RiskAssessmentService } from '../../../src/wiki/impact/risk-assessment';
import { SuggestionGenerator } from '../../../src/wiki/impact/suggestion-generator';
import { ImpactItem, RiskAssessment, RiskFactor } from '../../../src/wiki/impact/types';

const projectPath = 'f:\\dev\\opensource\\ts-ai-agent';

describe('ChangeImpactAnalyzer', () => {
  let analyzer: ChangeImpactAnalyzer;

  beforeEach(() => {
    analyzer = new ChangeImpactAnalyzer(projectPath);
  });

  describe('analyzeDirectImpact', () => {
    it('should analyze direct impact for modified file', async () => {
      const filePath = path.join(projectPath, 'src', 'wiki', 'types.ts');
      const impacts = await analyzer.analyzeDirectImpact(filePath, 'modified');

      expect(impacts).toBeInstanceOf(Array);
      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts[0].type).toBe('file');
      expect(impacts[0].impactLevel).toBe('medium');
    });

    it('should analyze direct impact for removed file', async () => {
      const filePath = path.join(projectPath, 'src', 'wiki', 'types.ts');
      const impacts = await analyzer.analyzeDirectImpact(filePath, 'removed');

      expect(impacts).toBeInstanceOf(Array);
      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts[0].impactLevel).toBe('high');
    });

    it('should analyze direct impact for added file', async () => {
      const filePath = path.join(projectPath, 'src', 'wiki', 'new-file.ts');
      const impacts = await analyzer.analyzeDirectImpact(filePath, 'added');

      expect(impacts).toBeInstanceOf(Array);
      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts[0].impactLevel).toBe('medium');
    });
  });

  describe('analyzeIndirectImpact', () => {
    it('should analyze indirect impact from direct impacts', async () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'test-1',
          type: 'file',
          name: 'types.ts',
          path: 'src/wiki/types.ts',
          impactLevel: 'medium',
          description: 'Modified file',
          affectedBy: ['src/wiki/types.ts'],
          affects: ['src/wiki/wiki-manager.ts', 'src/wiki/wiki-storage.ts'],
        },
      ];

      const indirectImpacts = await analyzer.analyzeIndirectImpact(directImpacts);

      expect(indirectImpacts).toBeInstanceOf(Array);
      expect(indirectImpacts.length).toBeGreaterThan(0);
      expect(indirectImpacts[0].type).toBe('file');
      expect(indirectImpacts[0].impactLevel).toBe('medium');
    });
  });

  describe('analyzeFullImpact', () => {
    it('should analyze full impact including direct, indirect, risk and suggestions', async () => {
      const filePath = path.join(projectPath, 'src', 'wiki', 'types.ts');
      const impact = await analyzer.analyzeFullImpact(filePath, 'modified');

      expect(impact).toBeDefined();
      expect(impact.directImpacts).toBeInstanceOf(Array);
      expect(impact.indirectImpacts).toBeInstanceOf(Array);
      expect(impact.impactChains).toBeInstanceOf(Array);
      expect(impact.riskAssessment).toBeDefined();
      expect(impact.suggestedActions).toBeInstanceOf(Array);
      expect(impact.summary).toBeDefined();
    });
  });
});

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  beforeEach(() => {
    service = new RiskAssessmentService();
  });

  describe('assessRisk', () => {
    it('should assess risk for impacts', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'test-1',
          type: 'file',
          name: 'types.ts',
          path: 'src/wiki/types.ts',
          impactLevel: 'high',
          description: 'Modified file',
          affectedBy: ['src/wiki/types.ts'],
          affects: [],
        },
      ];

      const indirectImpacts: ImpactItem[] = [];
      const riskAssessment = service.assessRisk(directImpacts, indirectImpacts, 'modified');

      expect(riskAssessment).toBeDefined();
      expect(riskAssessment.overallRisk).toBeDefined();
      expect(riskAssessment.riskScore).toBeGreaterThan(0);
      expect(riskAssessment.factors).toBeInstanceOf(Array);
    });

    it('should assess critical risk for removed file', () => {
      const directImpacts: ImpactItem[] = [
        {
          id: 'test-1',
          type: 'file',
          name: 'types.ts',
          path: 'src/wiki/types.ts',
          impactLevel: 'high',
          description: 'Removed file',
          affectedBy: ['src/wiki/types.ts'],
          affects: [],
        },
      ];

      const indirectImpacts: ImpactItem[] = [];
      const riskAssessment = service.assessRisk(directImpacts, indirectImpacts, 'removed');

      expect(riskAssessment.overallRisk).toBe('critical');
      expect(riskAssessment.riskScore).toBeGreaterThan(1.5);
    });
  });

  describe('calculateRiskScore', () => {
    it('should calculate risk score from factors', () => {
      const factors: RiskFactor[] = [
        {
          id: 'factor-1',
          type: 'breaking-change',
          description: 'Test factor',
          severity: 'high',
          confidence: 0.9,
          mitigation: 'Test mitigation',
        },
      ];

      const score = service.calculateRiskScore(factors);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(3);
    });
  });
});

describe('SuggestionGenerator', () => {
  let generator: SuggestionGenerator;

  beforeEach(() => {
    generator = new SuggestionGenerator(projectPath);
  });

  describe('generateSuggestions', () => {
    it('should generate suggestions based on impacts and risk', () => {
      const impacts: ImpactItem[] = [
        {
          id: 'test-1',
          type: 'file',
          name: 'types.ts',
          path: 'src/wiki/types.ts',
          impactLevel: 'high',
          description: 'Modified file',
          affectedBy: ['src/wiki/types.ts'],
          affects: [],
        },
      ];

      const riskAssessment: RiskAssessment = {
        id: 'risk-1',
        overallRisk: 'high',
        riskScore: 2.5,
        factors: [],
        affectedAreas: ['wiki'],
        timeframe: 'immediate',
        recommendation: 'Test recommendation',
      };

      const suggestions = generator.generateSuggestions(impacts, [], riskAssessment);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].priority).toBe('urgent');
    });

    it('should generate test suggestions', () => {
      const impacts: ImpactItem[] = [
        {
          id: 'test-1',
          type: 'test',
          name: 'types.test.ts',
          path: 'tests/wiki/types.test.ts',
          impactLevel: 'medium',
          description: 'Modified test file',
          affectedBy: ['tests/wiki/types.test.ts'],
          affects: [],
        },
      ];

      const riskAssessment: RiskAssessment = {
        id: 'risk-1',
        overallRisk: 'medium',
        riskScore: 1.5,
        factors: [],
        affectedAreas: ['tests'],
        timeframe: 'short-term',
        recommendation: 'Test recommendation',
      };

      const suggestions = generator.generateSuggestions(impacts, [], riskAssessment);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.some(s => s.type === 'test')).toBe(true);
    });

    it('should generate document update suggestions', () => {
      const impacts: ImpactItem[] = [
        {
          id: 'test-1',
          type: 'document',
          name: 'README.md',
          path: 'README.md',
          impactLevel: 'low',
          description: 'Modified document',
          affectedBy: ['README.md'],
          affects: [],
        },
      ];

      const riskAssessment: RiskAssessment = {
        id: 'risk-1',
        overallRisk: 'low',
        riskScore: 0.5,
        factors: [],
        affectedAreas: ['docs'],
        timeframe: 'long-term',
        recommendation: 'Test recommendation',
      };

      const suggestions = generator.generateSuggestions(impacts, [], riskAssessment);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.some(s => s.type === 'update')).toBe(true);
    });
  });
});
