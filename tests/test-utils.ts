import { transform } from '../src/transform.js'
import type { CompileOptions } from '../src/types.js'

export const defaultOptions: CompileOptions = {
  hmr: false,
  dev: false,
  ssr: false,
  runtimeModule: 'vitarx',
  sourceMap: false,
  transformClassNameToClass: false
}

export const devOptions: CompileOptions = {
  hmr: false,
  dev: true,
  ssr: false,
  runtimeModule: 'vitarx',
  sourceMap: false,
  transformClassNameToClass: false
}

export const classNameTransformOptions: CompileOptions = {
  hmr: false,
  dev: false,
  ssr: false,
  runtimeModule: 'vitarx',
  sourceMap: false,
  transformClassNameToClass: true
}

export async function compile(
  code: string,
  options: CompileOptions = defaultOptions
): Promise<string> {
  const result = await transform(code, '/test.tsx', options)
  return result?.code ?? ''
}
