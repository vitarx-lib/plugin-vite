import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type Plugin,
  type ResolvedConfig,
  type transformWithEsbuild,
  type transformWithOxc,
  version
} from 'vite'
import { type CompileOptions, transform } from './transform.js'
// 编译宏组件类型导出
export type * from './types.js'

/**
 * vite-plugin-vitarx 配置选项
 */
export interface VitePluginVitarxOptions {
  /**
   * 是否将 className 属性转换为 class 属性
   * 仅对原生 HTML 元素生效，组件不生效
   *
   * 当启用时：
   * - `<div className="test" />` 转换为 `<div class="test" />`
   * - 如果同时存在 class 和 className，会抛出错误（class 优先级更高）
   *
   * @default false
   */
  transformClassNameToClass?: boolean
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IS_V8 = version.startsWith('8')
let viteTransform: (
  code: string,
  filename: string,
  options: undefined,
  inMap: object | undefined,
  config: ResolvedConfig
) => ReturnType<typeof transformWithOxc> | ReturnType<typeof transformWithEsbuild>
if (IS_V8) {
  // @ts-ignore
  viteTransform = (await import('vite')).transformWithOxc
} else {
  viteTransform = (await import('vite')).transformWithEsbuild
}

/**
 * 检查文件是否需要转换
 */
function shouldTransform(id: string): boolean {
  const ext = id.split('?')[0].split('.').pop()?.toLowerCase()
  return ext === 'jsx' || ext === 'tsx'
}

/**
 * vite-plugin-vitarx
 *
 * 功能：
 * - jsx -> createView 编译转换
 * - 支持 v-if、v-else-if、v-else 、v-model 等编译宏指令
 * - 支持 Switch , IfBlock 等编译宏组件
 * - 开发时 HMR 热更新相关代码注入与功能支持
 * - 支持 className 转 class（仅原生 HTML 元素）
 *
 * @param options - 插件配置选项。
 * @returns - vite插件对象。
 */
export default function vitarx(options?: VitePluginVitarxOptions): Plugin {
  let compileOptions: CompileOptions
  let isDEV = false
  let isSSR = false
  let viteConfig: ResolvedConfig
  return {
    name: 'vite-plugin-vitarx',
    config(config, env) {
      isDEV = env.command === 'serve' && !env.isPreview
      const configSSR = !!config.build?.ssr
      isSSR = env.isSsrBuild === true || configSSR
      return {
        define: {
          __VITARX_DEV__: JSON.stringify(isDEV),
          __VITARX_SSR__: JSON.stringify(isSSR)
        },
        resolve: {
          alias: {
            '@vitarx/vite-plugin/hmr-client': path.join(__dirname, 'hmr-client/index.js')
          }
        },
        [IS_V8 ? 'oxc' : 'esbuild']: {
          jsx: 'preserve'
        }
      }
    },
    configResolved(config) {
      viteConfig = config
      compileOptions = {
        dev: isDEV,
        ssr: isSSR,
        hmr: isDEV && !isSSR,
        runtimeModule: 'vitarx',
        sourceMap: true,
        transformClassNameToClass: options?.transformClassNameToClass ?? false
      }
    },
    async transform(code, id) {
      if (!shouldTransform(id)) return null
      const result = await transform(code, id, compileOptions!)
      if (!result) return null
      return viteTransform(result.code, id, undefined, result.map || undefined, viteConfig!)
    }
  }
}
