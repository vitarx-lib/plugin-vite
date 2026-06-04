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
