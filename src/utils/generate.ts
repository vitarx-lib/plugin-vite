/**
 * 名称生成工具模块
 * 提供唯一别名和默认导出名称的生成功能
 * @module utils/generate
 */
import { DEFAULT_EXPORT_BASE_NAME } from '../constants/index.js'

/**
 * 生成唯一的别名
 * 从 $1 开始递增，直到找到不冲突的名称
 * @param baseName - 基础名称
 * @param existingNames - 已存在的名称集合（用于冲突检测）
 * @returns 唯一的别名
 */
export function generateUniqueAlias(baseName: string, existingNames: Set<string>): string {
  let index = 1
  // 循环查找不冲突的名称
  while (existingNames.has(`${baseName}$${index}`)) {
    index++
  }
  return `${baseName}$${index}`
}

/**
 * 生成唯一的默认导出组件名称
 * 优先使用基础名称，若冲突则生成唯一别名
 * @param existingNames - 已存在的名称集合
 * @returns 唯一的默认导出名称
 */
export function generateUniqueDefaultName(existingNames: Set<string>): string {
  // 如果默认名称未被占用，直接返回
  if (!existingNames.has(DEFAULT_EXPORT_BASE_NAME)) {
    return DEFAULT_EXPORT_BASE_NAME
  }
  // 否则生成唯一别名
  return generateUniqueAlias(DEFAULT_EXPORT_BASE_NAME, existingNames)
}
