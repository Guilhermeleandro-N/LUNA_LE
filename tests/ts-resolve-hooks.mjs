import { registerHooks } from 'node:module';

// O Metro/TypeScript resolvem imports sem extensão; o Node ESM, não.
// Este hook é usado apenas pelos testes automatizados em Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const canRetry =
        error?.code === 'ERR_MODULE_NOT_FOUND' &&
        /^\.{1,2}\//.test(specifier) &&
        !/\.[cm]?[jt]sx?$/.test(specifier);

      if (canRetry) {
        return nextResolve(`${specifier}.ts`, context);
      }

      throw error;
    }
  },
});
