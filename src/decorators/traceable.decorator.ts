import { Span } from './span.decorator';

/**
 * Class decorator that wraps every method of the class in a {@link Span}.
 *
 * Spans are named `prefix.methodName`, where `prefix` is the optional argument
 * or the class name. Getters, setters and the constructor are skipped.
 *
 * @param prefix Span-name prefix. Defaults to the class name.
 */
export function Traceable(prefix?: string): ClassDecorator {
  return (target: any) => {
    const proto = target.prototype;
    const spanPrefix = prefix ?? target.name;

    for (const methodName of Object.getOwnPropertyNames(proto)) {
      if (methodName === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, methodName);
      if (!descriptor || typeof descriptor.value !== 'function') continue;

      Span(`${spanPrefix}.${methodName}`)(proto, methodName, descriptor);
      Object.defineProperty(proto, methodName, descriptor);
    }

    return target;
  };
}
