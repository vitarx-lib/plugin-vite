/**
 * HMR 组件更新：统一「卸载 → 重建 → 挂载」语义
 *
 * 任何代码变更（含纯 UI/注释）都走完整重挂载：dispose 触发旧实例的
 * onDispose/onScopeDispose 清理副作用，init 重执行组件函数（状态经
 * memo/快照协议保留），mount 触发 onMounted——dev 与生产的生命周期
 * 语义完全一致，不区分 logic/非 logic 分叉，不存在钩子滞留或孤儿监听。
 * @module hmr-client/update
 */
import { Component, ComponentView, getRenderer } from 'vitarx'

/**
 * 处理组件更新：卸载旧实例 → 重建（重执行组件函数，状态经快照恢复）→ 挂载
 * @param view - 组件视图对象，包含当前组件的实例和节点信息
 * @param newComponent - 新的组件定义
 */
export function processUpdate(view: ComponentView, newComponent: Component): void {
  // 获取渲染器实例，创建占位注释节点并插入到旧元素位置，
  // 作为新旧子树替换的锚点
  const renderer = getRenderer()
  const placeholder = renderer.createComment('')
  renderer.insert(placeholder, view.node)
  // 更新视图中的组件引用为最新模块导出
  Object.defineProperty(view, 'component', {
    value: newComponent,
    writable: true,
    enumerable: true,
    configurable: true
  })
  // 完整重挂载：dispose（清理旧副作用，触发 onDispose/onScopeDispose）
  // → init（重执行组件函数，memo 命中快照保留状态）
  // → mount（触发 onMounted，重新注册副作用）
  // 注意：ctx 必须在 dispose 之前捕获——dispose 会拆除 provide 链，
  // 之后读取 ctx 会导致重执行时 inject（如 useRouter）解析失败
  const ctx = view.ctx
  view.dispose()
  view.init(ctx)
  view.mount(placeholder, 'replace')
}
