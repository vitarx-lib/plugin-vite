import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type ESBuildOptions,
  type Plugin,
  type ResolvedConfig,
  type UserConfig,
  version
} from 'vite'
import { type CompileOptions, transform } from './transform.js'
// 编译宏组件类型导出
export type * from './types.js'

/**
 * vite-plugin-vitarx 配置选项
 *
 * 暂无配置选项
 */
export interface VitePluginVitarxOptions {}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IS_V8 = version.startsWith('8')
let viteTransform: (
  code: string,
  filename: string,
  options: undefined,
  inMap: object,
  config: ResolvedConfig
) => any
if (IS_V8) {
  // @ts-ignore
  viteTransform = (await import('vite')).transformWithOxc
} else {
  viteTransform = (await import('vite')).transformWithEsbuild
}
/**
 * vite-plugin-vitarx
 *
 * 功能：
 * - jsx -> createView 编译转换
 * - 支持 v-if、v-else-if、v-else 、v-model 等编译宏指令
 * - 支持 Switch , IfBlock 等编译宏组件
 * - 开发时 HMR 热更新相关代码注入与功能支持
 *
 * @param _options - 暂无可选配置。
 * @returns - vite插件对象。
 */
export default function vitarx(_options?: VitePluginVitarxOptions): Plugin {
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
      const buildConfig: ESBuildOptions = {
        jsx: 'preserve',
        exclude: /\.[jt]sx$/
      }
      const _config: UserConfig = {
        define: {
          __VITARX_DEV__: JSON.stringify(isDEV),
          __VITARX_SSR__: JSON.stringify(isSSR)
        },
        resolve: {
          alias: {
            '@vitarx/vite-plugin/hmr-client': path.join(__dirname, 'hmr-client/index.js')
          }
        }
      }
      _config[IS_V8 ? ('oxc' as 'esbuild') : 'esbuild'] = buildConfig
      return _config
    },
    configResolved(config) {
      viteConfig = config
      compileOptions = {
        dev: isDEV,
        ssr: isSSR,
        hmr: isDEV && !isSSR,
        runtimeModule: 'vitarx',
        sourceMap: false
      }
    },
    async transform(code, id) {
      const result = await transform(code, id, compileOptions!)
      if (!result) return null
      return await viteTransform(
        result.code,
        id,
        undefined,
        this.getCombinedSourcemap(),
        viteConfig!
      )
    }
  }
}
