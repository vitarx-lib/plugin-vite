/**
 * Vitarx 运行时 API 名称
 * 这些 API 需要从 vitarx 包导入
 */
/**
 * UI 相关的 API 名称列表
 * 这些 API 用于创建视图，在 HMR 时需要识别
 */
export const UI_API_NAMES = ['createView', 'branch', 'dynamic', 'expr', 'accessor', 'withDirectives'] as const

/**
 * Ref 相关 API 名称
 * 用于识别 ref 变量
 */
export const REF_APIS = {
  REF: 'ref',
  TO_REF: 'toRef',
  TO_REFS: 'toRefs',
  SHALLOW_REF: 'shallowRef',
  COMPUTED: 'computed'
} as const

/**
 * 支持的响应式模块
 * 从这些模块导入的 ref API 会被识别
 */
export const RESPONSIVE_MODULES = ['vitarx', '@vitarx/responsive'] as const

/**
 * 纯编译组件名称
 * 这些组件在编译时会被完全转换
 */
export const PURE_COMPILE_COMPONENTS = ['Switch', 'Match', 'IfBlock'] as const

/**
 * 指令前缀
 */
export const DIRECTIVE_PREFIX = 'v-'

/**
 * 纯函数注释
 */
export const PURE_COMMENT = '@__PURE__'

/**
 * vitarx 模块名称
 */
export const VITARX_MODULE = 'vitarx'

/**
 * 标识符
 */
export enum HMR {
  manager = '__$VITARX_HMR$__',
  id = '__$VITARX_HMR_COMPONENT_ID$__',
  view = '__$VITARX_HMR_VIEW_NODE$__',
  state = '__$VITARX_HMR_VIEW_STATE$__'
}

/** 默认导出组件基础名称 */
export const DEFAULT_EXPORT_BASE_NAME = '_defaultExport'
