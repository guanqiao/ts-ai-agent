import { ServiceLocator, ServiceToken, DIContainer, ServiceLifetime } from '@core/di';

describe('ServiceLocator', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
    ServiceLocator.setContainer(container);
  });

  afterEach(() => {
    ServiceLocator.reset();
  });

  describe('get', () => {
    it('should resolve service from container', () => {
      const token = ServiceToken.create<ITestService>('ITestService');

      container.register(token, {
        factory: () => new TestService(),
        lifetime: ServiceLifetime.Singleton,
      });

      const service = ServiceLocator.get(token);

      expect(service).toBeInstanceOf(TestService);
    });

    it('should throw if container not set', () => {
      ServiceLocator.reset();
      const token = ServiceToken.create<ITestService>('ITestService');

      expect(() => ServiceLocator.get(token)).toThrow('ServiceLocator not initialized');
    });
  });

  describe('tryGet', () => {
    it('should return service if registered', () => {
      const token = ServiceToken.create<ITestService>('ITestService');

      container.register(token, {
        factory: () => new TestService(),
        lifetime: ServiceLifetime.Singleton,
      });

      const service = ServiceLocator.tryGet(token);

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(TestService);
    });

    it('should return undefined if not registered', () => {
      const token = ServiceToken.create<ITestService>('UnregisteredService');

      const service = ServiceLocator.tryGet(token);

      expect(service).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered service', () => {
      const token = ServiceToken.create<ITestService>('ITestService');

      container.register(token, {
        factory: () => new TestService(),
        lifetime: ServiceLifetime.Transient,
      });

      expect(ServiceLocator.has(token)).toBe(true);
    });

    it('should return false for unregistered service', () => {
      const token = ServiceToken.create<ITestService>('UnregisteredService');

      expect(ServiceLocator.has(token)).toBe(false);
    });
  });

  describe('setContainer', () => {
    it('should set new container', () => {
      const newContainer = new DIContainer();
      const token = ServiceToken.create<ITestService>('ITestService');

      newContainer.register(token, {
        factory: () => new TestService('new'),
        lifetime: ServiceLifetime.Singleton,
      });

      ServiceLocator.setContainer(newContainer);

      expect(ServiceLocator.get(token)).toBeInstanceOf(TestService);
    });
  });

  describe('reset', () => {
    it('should clear container reference', () => {
      const token = ServiceToken.create<ITestService>('ITestService');

      container.register(token, {
        factory: () => new TestService(),
        lifetime: ServiceLifetime.Singleton,
      });

      ServiceLocator.reset();

      expect(() => ServiceLocator.get(token)).toThrow('ServiceLocator not initialized');
    });
  });
});

interface ITestService {
  getValue(): string;
}

class TestService implements ITestService {
  constructor(private value: string = 'test') {}

  getValue(): string {
    return this.value;
  }
}
