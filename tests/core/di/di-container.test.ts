import { DIContainer, ServiceToken, ServiceLifetime, IDisposable } from '@core/di';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('register and resolve', () => {
    it('should register and resolve a transient service', () => {
      const token = ServiceToken.create<ITestService>('ITestService');

      container.register(token, {
        factory: () => new TestService(),
        lifetime: ServiceLifetime.Transient,
      });

      const service1 = container.resolve(token);
      const service2 = container.resolve(token);

      expect(service1).toBeInstanceOf(TestService);
      expect(service2).toBeInstanceOf(TestService);
      expect(service1).not.toBe(service2);
    });

    it('should register and resolve a singleton service', () => {
      const token = ServiceToken.create<ITestService>('ITestService');

      container.register(token, {
        factory: () => new TestService(),
        lifetime: ServiceLifetime.Singleton,
      });

      const service1 = container.resolve(token);
      const service2 = container.resolve(token);

      expect(service1).toBe(service2);
    });

    it('should register and resolve a scoped service', () => {
      const token = ServiceToken.create<ITestService>('ITestService');

      container.register(token, {
        factory: () => new TestService(),
        lifetime: ServiceLifetime.Scoped,
      });

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const service1a = scope1.resolve(token);
      const service1b = scope1.resolve(token);
      const service2a = scope2.resolve(token);

      expect(service1a).toBe(service1b);
      expect(service1a).not.toBe(service2a);
    });

    it('should throw error when resolving unregistered service', () => {
      const token = ServiceToken.create<ITestService>('UnregisteredService');

      expect(() => container.resolve(token)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('not registered'),
        })
      );
    });
  });

  describe('dependency injection', () => {
    it('should inject dependencies via factory', () => {
      const depToken = ServiceToken.create<IDependency>('IDependency');
      const serviceToken = ServiceToken.create<IServiceWithDependency>('IServiceWithDependency');

      container.register(depToken, {
        factory: () => new Dependency(),
        lifetime: ServiceLifetime.Singleton,
      });

      container.register(serviceToken, {
        factory: (c: DIContainer) => new ServiceWithDependency(c.resolve(depToken)),
        lifetime: ServiceLifetime.Transient,
      });

      const service = container.resolve(serviceToken);

      expect(service.getDependency()).toBeInstanceOf(Dependency);
    });

    it('should inject multiple dependencies', () => {
      const dep1Token = ServiceToken.create<IDependency>('IDependency1');
      const dep2Token = ServiceToken.create<IDependency>('IDependency2');
      const serviceToken = ServiceToken.create<IServiceWithMultipleDeps>('IServiceWithMultipleDeps');

      container.register(dep1Token, {
        factory: () => new Dependency('dep1'),
        lifetime: ServiceLifetime.Singleton,
      });

      container.register(dep2Token, {
        factory: () => new Dependency('dep2'),
        lifetime: ServiceLifetime.Singleton,
      });

      container.register(serviceToken, {
        factory: (c: DIContainer) => new ServiceWithMultipleDeps(c.resolve(dep1Token), c.resolve(dep2Token)),
        lifetime: ServiceLifetime.Transient,
      });

      const service = container.resolve(serviceToken);

      expect(service.getDependencies()).toEqual(['dep1', 'dep2']);
    });
  });

  describe('registerInstance', () => {
    it('should register an existing instance', () => {
      const token = ServiceToken.create<ITestService>('ITestService');
      const instance = new TestService();

      container.registerInstance(token, instance);

      const resolved = container.resolve(token);

      expect(resolved).toBe(instance);
    });
  });

  describe('has', () => {
    it('should return true for registered service', () => {
      const token = ServiceToken.create<ITestService>('ITestService');

      container.register(token, {
        factory: () => new TestService(),
        lifetime: ServiceLifetime.Transient,
      });

      expect(container.has(token)).toBe(true);
    });

    it('should return false for unregistered service', () => {
      const token = ServiceToken.create<ITestService>('UnregisteredService');

      expect(container.has(token)).toBe(false);
    });
  });

  describe('tryResolve', () => {
    it('should return service if registered', () => {
      const token = ServiceToken.create<ITestService>('ITestService');

      container.register(token, {
        factory: () => new TestService(),
        lifetime: ServiceLifetime.Transient,
      });

      const result = container.tryResolve(token);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(TestService);
    });

    it('should return undefined if not registered', () => {
      const token = ServiceToken.create<ITestService>('UnregisteredService');

      const result = container.tryResolve(token);

      expect(result).toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('should dispose all disposable singletons', () => {
      const token = ServiceToken.create<IDisposableService>('IDisposableService');

      container.register(token, {
        factory: () => new DisposableService(),
        lifetime: ServiceLifetime.Singleton,
      });

      const service = container.resolve(token);
      container.dispose();

      expect(service.disposed).toBe(true);
    });

    it('should clear all registrations', () => {
      const token = ServiceToken.create<ITestService>('ITestService');

      container.register(token, {
        factory: () => new TestService(),
        lifetime: ServiceLifetime.Singleton,
      });

      container.dispose();

      expect(container.has(token)).toBe(false);
    });
  });
});

interface ITestService {
  getValue(): string;
}

class TestService implements ITestService {
  getValue(): string {
    return 'test';
  }
}

interface IDependency {
  getName(): string;
}

class Dependency implements IDependency {
  constructor(private name: string = 'default') {}

  getName(): string {
    return this.name;
  }
}

interface IServiceWithDependency {
  getDependency(): IDependency;
}

class ServiceWithDependency implements IServiceWithDependency {
  constructor(private dependency: IDependency) {}

  getDependency(): IDependency {
    return this.dependency;
  }
}

interface IServiceWithMultipleDeps {
  getDependencies(): string[];
}

class ServiceWithMultipleDeps implements IServiceWithMultipleDeps {
  constructor(private dep1: IDependency, private dep2: IDependency) {}

  getDependencies(): string[] {
    return [this.dep1.getName(), this.dep2.getName()];
  }
}

interface IDisposableService {
  disposed: boolean;
}

class DisposableService implements IDisposableService, IDisposable {
  disposed = false;

  dispose(): void {
    this.disposed = true;
  }
}
