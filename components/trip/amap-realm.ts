import type { AMapNamespace } from "./amap-client-types";

/** SDK internals use realm-specific instanceof Array checks. Convert our plain
 * options/arrays into the iframe's realm, preserving DOM nodes and SDK objects. */
export function bridgeAMapRealm(namespace: AMapNamespace, realm: { Array: ArrayConstructor; Object: ObjectConstructor }): AMapNamespace {
  function convert(value: unknown): unknown {
    if (Array.isArray(value)) {
      const array = new realm.Array();
      for (const item of value) array.push(convert(item));
      return array;
    }
    if (value && typeof value === "object" && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
      const object = new realm.Object() as Record<string, unknown>;
      for (const [key, item] of Object.entries(value)) object[key] = convert(item);
      return object;
    }
    return value;
  }
  function wrapConstructor(constructor: new (...args: never[]) => unknown, bindMethods = false) {
    return function (...args: unknown[]) {
      const instance = Reflect.construct(constructor, args.map(convert));
      if (!bindMethods) return instance;
      return new Proxy(instance, { get(target, property) {
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? (...parameters: unknown[]) => Reflect.apply(value, target, parameters.map(convert)) : value;
      } });
    };
  }
  return {
    Map: wrapConstructor(namespace.Map, true),
    Marker: wrapConstructor(namespace.Marker),
    Polyline: wrapConstructor(namespace.Polyline),
  } as unknown as AMapNamespace;
}
