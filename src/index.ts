import path from 'node:path'
import { type Plugin, type ResolvedConfig, transformWithOxc } from 'vite'
import { type CompileOptions, transform } from './transform.js'

// 编译宏组件类型导出
export type * from './components.js'

/**
 * vite-plugin-vitarx 配置选项
 *
 * 暂无配置选项
 */
export interface VitePluginVitarxOptions {}

const __dirname = path.dirname(new URL(import.meta.url).pathname)
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
  let viteConfig:ResolvedConfig
  return {
    name: 'vite-plugin-vitarx',
    config(config, env) {
      isDEV = env.command === 'serve' && !env.isPreview
      const configSSR = !!config.build?.ssr
      isSSR = env.isSsrBuild === true || configSSR
      return {
        oxc:{
          jsx:'preserve',
          exclude: /\.[jt]sx$/,
        },
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
    },
    configResolved(config) {
      viteConfig = config
      const sourcemap = config.build.sourcemap
      compileOptions = {
        dev: isDEV,
        ssr: isSSR,
        hmr: isDEV && !isSSR,
        runtimeModule: 'vitarx',
        sourceMap: sourcemap === 'inline' ? 'inline' : sourcemap === true ? 'both' : false
      }
    },
    async transform(code, id) {
      const result = await transform(code, id, compileOptions!)
      if (result){
       return await transformWithOxc(result.code, id, {
          jsx: 'preserve'
        },result.map,viteConfig!)
      }
      return result
    }
  }
}
