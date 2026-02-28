/**
 * Props 处理模块 - 类型定义
 * @module passes/props/types
 */
import * as t from '@babel/types'

/**
 * 指令信息
 */
export interface DirectiveInfo {
  /** 指令值表达式 */
  value: t.Expression
  /** 指令参数 (如 v-test:t 中的 t) */
  arg?: string
}

/**
 * Props 处理结果
 */
export interface PropsResult {
  /** 处理后的 props 对象表达式，无属性时为 null */
  props: t.ObjectExpression | null
  /** 指令映射表，key 为指令名，value 为指令信息 */
  directives: Map<string, DirectiveInfo>
  /** 是否包含 v-bind 展开属性 */
  hasVBind: boolean
}

/**
 * v-model 指令状态
 */
export interface VModelState {
  /** 是否存在 v-model 指令 */
  hasVModel: boolean
  /** v-model 绑定的值表达式 */
  value: t.Expression | null
  /** v-model 属性节点，用于错误定位 */
  node: t.JSXAttribute | null
}

/**
 * 属性处理结果联合类型
 * - directive: 指令类型属性
 * - property: 普通属性
 */
export type AttributeResult =
  | {
      type: 'directive'
      name: string
      value: t.Expression
      isVBind: boolean
      isVModel: boolean
      arg?: string
    }
  | { type: 'property'; property: t.ObjectProperty | t.ObjectMethod }
