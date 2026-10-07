/**
 * HMR 视图弱引用集合工具
 *
 * #idMapToView 借助 WeakRef 让已销毁视图可被 GC 回收，避免被管理器
 * 永久强引用造成内存泄漏。GC 可达性天然区分「Freeze 停用」与
 * 「真销毁」——Freeze 缓存持有视图强引用，停用中的视图不会被回收，
 * 热更新照常处理；真销毁的视图无引用可回收，deref() 返回空，遍历时剪枝。
 *
 * 剪枝/去重逻辑抽为纯函数并接受 WeakRefLike 结构类型，便于以伪引用
 * 做确定性单元测试（真实 WeakRef 的 deref 时点依赖 GC，无法确定性断言）。
 * @module hmr-client/weak-refs
 */
import type { ComponentView } from 'vitarx'

/**
 * WeakRef 结构类型
 *
 * 真实 WeakRef 天然满足此结构；测试可注入自定义伪引用。
 */
export interface WeakRefLike<T extends object> {
  deref(): T | undefined
}

/**
 * 向引用集合登记视图：剪枝死引用 + 按 deref 比对去重
 *
 * WeakRef 身份 ≠ 视图身份，同一视图多次登记（组件每次执行都会
 * register）必须按解引用结果比对，否则集合会被同视图的多个
 * WeakRef 无限撑大。
 * @param refs - 视图弱引用集合（原地修改）
 * @param view - 待登记的视图
 */
export function registerViewRef(refs: Set<WeakRefLike<ComponentView>>, view: ComponentView): void {
  let exists = false
  for (const ref of refs) {
    const cached = ref.deref()
    if (!cached) {
      refs.delete(ref)
    } else if (cached === view) {
      exists = true
    }
  }
  if (!exists) refs.add(new WeakRef(view))
}

/**
 * 收集集合中仍存活（未被 GC）的视图，并原地剪枝死引用
 * @param refs - 视图弱引用集合（原地修改）
 * @returns 存活视图数组
 */
export function collectLiveViews(refs: Set<WeakRefLike<ComponentView>>): ComponentView[] {
  const live: ComponentView[] = []
  for (const ref of refs) {
    const view = ref.deref()
    if (view) {
      live.push(view)
    } else {
      refs.delete(ref)
    }
  }
  return live
}
