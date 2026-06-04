/**
 * AST 模式处理辅助函数
 * 用于处理解构模式、绑定模式等
 * @module utils/pattern-helpers
 */
import type { LVal, ObjectPattern } from '@babel/types'

/**
 * 从绑定模式中收集变量名
 * 支持标识符、对象模式、数组模式
 * @param pattern - 绑定模式节点
 * @param variables - 存储变量名的集合
 */
export function collectPatternBindings(pattern: LVal, variables: Set<string>): void {
  // 处理简单标识符
  if (pattern.type === 'Identifier') {
    variables.add(pattern.name)
  } else if (pattern.type === 'ObjectPattern') {
    // 处理对象解构模式
    for (const prop of pattern.properties) {
      if (prop.type === 'RestElement') {
        // 处理剩余运算符（...rest）
        collectPatternBindings(prop.argument, variables)
      } else {
        // 处理普通属性，递归收集 value
        collectPatternBindings(prop.value as LVal, variables)
      }
    }
  } else if (pattern.type === 'ArrayPattern') {
    // 处理数组解构模式
    for (const elem of pattern.elements) {
      if (elem) {
        // 递归处理每个非空元素
        collectPatternBindings(elem as LVal, variables)
      }
    }
  }
}

/**
 * 从对象解构模式中收集变量名
 * 专门用于 toRefs 解构场景
 * @param pattern - 对象模式节点
 * @param variables - 存储变量名的集合
 */
export function collectObjectPatternBindings(pattern: ObjectPattern, variables: Set<string>): void {
  for (const prop of pattern.properties) {
    if (prop.type === 'RestElement') {
      // 处理剩余运算符
      collectPatternBindings(prop.argument, variables)
    } else if (prop.value.type === 'Identifier') {
      // 处理简单标识符属性
      variables.add(prop.value.name)
    } else if (prop.value.type === 'ObjectPattern') {
      // 处理嵌套对象解构，递归收集
      collectObjectPatternBindings(prop.value, variables)
    }
  }
}
