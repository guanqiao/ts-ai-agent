export interface ServiceDescriptor<T = unknown> {
  factory: (container: DIContainer) => T;
  lifetime: ServiceLifetime;
}

export enum ServiceLifetime {
  Transient = 'transient',
  Singleton = 'singleton',
  Scoped = 'scoped',
}

export interface IServiceToken<_T = unknown> {
  readonly name: string;
}

class ServiceTokenImpl implements IServiceToken {
  constructor(public readonly name: string) {}
  toString(): string {
    return `ServiceToken(${this.name})`;
  }
}

export const ServiceToken = {
  create<T>(name: string): IServiceToken<T> {
    return new ServiceTokenImpl(name);
  },
};

export interface IDisposable {
  dispose(): void;
}

export interface ServiceScope {
  resolve<T>(token: IServiceToken<T>): T;
  tryResolve<T>(token: IServiceToken<T>): T | undefined;
  dispose(): void;
}

class ServiceScopeImpl implements ServiceScope {
  private scopedInstances: Map<string, unknown> = new Map();

  constructor(private container: DIContainer) {}

  resolve<T>(token: IServiceToken<T>): T {
    const descriptor = this.container.getDescriptor(token);
    if (!descriptor) {
      throw new Error(`Service '${token.name}' is not registered`);
    }

    if (descriptor.lifetime === ServiceLifetime.Scoped) {
      const key = token.name;
      if (this.scopedInstances.has(key)) {
        return this.scopedInstances.get(key) as T;
      }
      const instance = descriptor.factory(this.container) as T;
      this.scopedInstances.set(key, instance);
      return instance;
    }

    return this.container.resolve(token);
  }

  tryResolve<T>(token: IServiceToken<T>): T | undefined {
    try {
      return this.resolve(token);
    } catch {
      return undefined;
    }
  }

  dispose(): void {
    for (const instance of this.scopedInstances.values()) {
      if (isDisposable(instance)) {
        instance.dispose();
      }
    }
    this.scopedInstances.clear();
  }
}

function isDisposable(obj: unknown): obj is IDisposable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'dispose' in obj &&
    typeof (obj as IDisposable).dispose === 'function'
  );
}

export class DIContainer {
  private registrations: Map<string, ServiceDescriptor> = new Map();
  private singletonInstances: Map<string, unknown> = new Map();

  register<T>(token: IServiceToken<T>, descriptor: ServiceDescriptor<T>): void {
    this.registrations.set(token.name, descriptor);
  }

  registerInstance<T>(token: IServiceToken<T>, instance: T): void {
    this.singletonInstances.set(token.name, instance);
    this.registrations.set(token.name, {
      factory: () => instance,
      lifetime: ServiceLifetime.Singleton,
    });
  }

  resolve<T>(token: IServiceToken<T>): T {
    const descriptor = this.getDescriptor(token);
    if (!descriptor) {
      throw new Error(`Service '${token.name}' is not registered`);
    }

    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      const key = token.name;
      if (this.singletonInstances.has(key)) {
        return this.singletonInstances.get(key) as T;
      }
      const instance = descriptor.factory(this) as T;
      this.singletonInstances.set(key, instance);
      return instance;
    }

    return descriptor.factory(this) as T;
  }

  tryResolve<T>(token: IServiceToken<T>): T | undefined {
    try {
      return this.resolve(token);
    } catch {
      return undefined;
    }
  }

  has(token: IServiceToken<unknown>): boolean {
    return this.registrations.has(token.name);
  }

  getDescriptor<T>(token: IServiceToken<T>): ServiceDescriptor<T> | undefined {
    return this.registrations.get(token.name) as ServiceDescriptor<T> | undefined;
  }

  createScope(): ServiceScope {
    return new ServiceScopeImpl(this);
  }

  dispose(): void {
    for (const instance of this.singletonInstances.values()) {
      if (isDisposable(instance)) {
        instance.dispose();
      }
    }
    this.singletonInstances.clear();
    this.registrations.clear();
  }
}

export class ServiceLocator {
  private static container: DIContainer | null = null;

  static setContainer(container: DIContainer): void {
    ServiceLocator.container = container;
  }

  static getContainer(): DIContainer | null {
    return ServiceLocator.container;
  }

  static get<T>(token: IServiceToken<T>): T {
    if (!ServiceLocator.container) {
      throw new Error('ServiceLocator not initialized. Call setContainer first.');
    }
    return ServiceLocator.container.resolve(token);
  }

  static tryGet<T>(token: IServiceToken<T>): T | undefined {
    if (!ServiceLocator.container) {
      return undefined;
    }
    return ServiceLocator.container.tryResolve(token);
  }

  static has(token: IServiceToken<unknown>): boolean {
    if (!ServiceLocator.container) {
      return false;
    }
    return ServiceLocator.container.has(token);
  }

  static reset(): void {
    ServiceLocator.container = null;
  }
}
