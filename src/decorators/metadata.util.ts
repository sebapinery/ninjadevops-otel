import 'reflect-metadata';

/**
 * Copy every `reflect-metadata` key from one function to another.
 *
 * NestJS stores route params, guards, pipes, etc. as metadata on the original
 * method. When a decorator replaces the method with a wrapper, that metadata
 * must be carried over or Nest's request pipeline breaks. The wrapper's `name`
 * and `length` are preserved too so stack traces and arity stay meaningful.
 */
export function copyMethodMetadata(
  original: (...args: any[]) => any,
  wrapper: (...args: any[]) => any,
): void {
  for (const key of Reflect.getMetadataKeys(original)) {
    Reflect.defineMetadata(key, Reflect.getMetadata(key, original), wrapper);
  }

  Object.defineProperty(wrapper, 'name', {
    value: original.name,
    configurable: true,
  });
  Object.defineProperty(wrapper, 'length', {
    value: original.length,
    configurable: true,
  });
}
