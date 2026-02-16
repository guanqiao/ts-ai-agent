import { IntentInference } from '../../../src/wiki/knowledge/intent-inference';
import { ParsedFile, SymbolKind, Language } from '../../../src/types';

describe('IntentInference', () => {
  let inference: IntentInference;

  beforeEach(() => {
    inference = new IntentInference();
  });

  const createMockFile = (
    path: string,
    content: string,
    symbols: Array<{ name: string; kind: SymbolKind; documentation?: string }> = []
  ): ParsedFile => ({
    path,
    rawContent: content,
    language: Language.TypeScript,
    symbols: symbols.map((s) => ({
      name: s.name,
      kind: s.kind,
      location: { file: path, line: 1, column: 1, endLine: 10, endColumn: 1 },
      documentation: s.documentation,
    })),
    imports: [],
    exports: [],
  });

  describe('inferIntent', () => {
    it('should infer intent from class with descriptive name', async () => {
      const file = createMockFile('src/services/user-authentication.service.ts', `
        export class UserAuthenticationService {
          async login(username: string, password: string): Promise<AuthToken> {
            // Validate credentials and generate token
          }
          async logout(token: string): Promise<void> {
            // Invalidate token
          }
        }
      `);

      const result = await inference.inferIntent(file);

      expect(result).toBeDefined();
      expect(result.primaryIntent).toContain('authentication');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should infer intent from function documentation', async () => {
      const file = createMockFile(
        'src/utils/calculator.ts',
        `
        /**
         * Calculates the total price including tax
         * @param basePrice - The base price before tax
         * @param taxRate - The tax rate as decimal
         * @returns The total price including tax
         */
        export function calculateTotalPrice(basePrice: number, taxRate: number): number {
          return basePrice * (1 + taxRate);
        }
      `,
        [
          {
            name: 'calculateTotalPrice',
            kind: SymbolKind.Function,
            documentation: 'Calculates the total price including tax',
          },
        ]
      );

      const result = await inference.inferIntent(file);

      expect(result).toBeDefined();
      expect(result.primaryIntent).toContain('price');
    });

    it('should identify design patterns', async () => {
      const file = createMockFile('src/patterns/singleton.ts', `
        export class DatabaseConnection {
          private static instance: DatabaseConnection;
          private constructor() {}
          static getInstance(): DatabaseConnection {
            if (!DatabaseConnection.instance) {
              DatabaseConnection.instance = new DatabaseConnection();
            }
            return DatabaseConnection.instance;
          }
        }
      `);

      const result = await inference.inferIntent(file);

      expect(result.patterns).toBeDefined();
      expect(result.patterns).toContain('singleton');
    });

    it('should detect architectural layer', async () => {
      const controllerFile = createMockFile('src/controllers/user.controller.ts', `
        export class UserController {
          async getUser(req: Request, res: Response) {
            // Handle GET /users/:id
          }
        }
      `);

      const result = await inference.inferIntent(controllerFile);

      expect(result.architecturalLayer).toBe('controller');
    });

    it('should infer relationships between components', async () => {
      const file = createMockFile('src/services/order.service.ts', `
        import { UserRepository } from './user.repository';
        import { ProductRepository } from './product.repository';
        
        export class OrderService {
          constructor(
            private userRepo: UserRepository,
            private productRepo: ProductRepository
          ) {}
        }
      `);

      const result = await inference.inferIntent(file);

      expect(result.dependencies).toBeDefined();
      expect(result.dependencies.length).toBeGreaterThan(0);
    });
  });

  describe('inferDecisionRationale', () => {
    it('should infer rationale from code comments', async () => {
      const file = createMockFile('src/cache/redis-cache.ts', `
        // Using Redis for caching because:
        // 1. High performance for read-heavy workloads
        // 2. Built-in expiration support
        // 3. Distributed caching capability
        export class RedisCache {
          // Implementation
        }
      `);

      const result = await inference.inferDecisionRationale(file);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].rationale).toContain('Redis');
    });

    it('should detect trade-offs in implementation', async () => {
      const file = createMockFile('src/search/linear-search.ts', `
        // Trade-off: Using linear search for simplicity
        // O(n) time complexity but O(1) space
        // Suitable for small datasets
        export function linearSearch(arr: number[], target: number): number {
          for (let i = 0; i < arr.length; i++) {
            if (arr[i] === target) return i;
          }
          return -1;
        }
      `);

      const result = await inference.inferDecisionRationale(file);

      expect(result.some((r) => r.type === 'trade-off')).toBe(true);
    });
  });

  describe('extractImplicitKnowledge', () => {
    it('should extract naming conventions as knowledge', async () => {
      const files = [
        createMockFile('src/services/user.service.ts', ''),
        createMockFile('src/services/product.service.ts', ''),
        createMockFile('src/services/order.service.ts', ''),
      ];

      const result = await inference.extractImplicitKnowledge(files);

      expect(result).toBeDefined();
      expect(result.some((k) => k.type === 'naming-convention')).toBe(true);
    });

    it('should extract architectural decisions', async () => {
      const files = [
        createMockFile('src/controllers/user.controller.ts', ''),
        createMockFile('src/services/user.service.ts', ''),
        createMockFile('src/repositories/user.repository.ts', ''),
      ];

      const result = await inference.extractImplicitKnowledge(files);

      expect(result.some((k) => k.type === 'architectural-pattern')).toBe(true);
    });

    it('should detect dependency patterns', async () => {
      const files = [
        createMockFile('src/services/auth.service.ts', `import { Logger } from '../utils/logger';`),
        createMockFile('src/services/user.service.ts', `import { Logger } from '../utils/logger';`),
      ];

      const result = await inference.extractImplicitKnowledge(files);

      expect(result.some((k) => k.type === 'common-dependency')).toBe(true);
    });
  });

  describe('inferBusinessDomain', () => {
    it('should infer business domain from code', async () => {
      const files = [
        createMockFile('src/services/payment.service.ts', ''),
        createMockFile('src/services/invoice.service.ts', ''),
        createMockFile('src/services/refund.service.ts', ''),
      ];

      const result = await inference.inferBusinessDomain(files);

      expect(result).toBeDefined();
      expect(result.domain).toBe('finance');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect multiple domains', async () => {
      const files = [
        createMockFile('src/services/user.service.ts', ''),
        createMockFile('src/services/payment.service.ts', ''),
        createMockFile('src/services/notification.service.ts', ''),
      ];

      const result = await inference.inferBusinessDomain(files);

      expect(result.domains).toBeDefined();
      expect(result.domains.length).toBeGreaterThan(1);
    });
  });

  describe('generateKnowledgeReport', () => {
    it('should generate comprehensive knowledge report', async () => {
      const files = [
        createMockFile('src/services/user.service.ts', `
          // Service for managing user operations
          export class UserService {
            async createUser(data: UserData): Promise<User> {
              // Creates a new user
            }
          }
        `),
        createMockFile('src/repositories/user.repository.ts', `
          export class UserRepository {
            async findById(id: string): Promise<User | null> {
              // Find user by ID
            }
          }
        `),
      ];

      const result = await inference.generateKnowledgeReport(files);

      expect(result).toBeDefined();
      expect(result.intents).toBeDefined();
      expect(result.patterns).toBeDefined();
      expect(result.architecturalLayers).toBeDefined();
      expect(result.domains).toBeDefined();
    });
  });
});
