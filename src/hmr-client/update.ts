import {
  Component,
  ComponentInstance,
  ComponentView,
  createCommentView,
  EffectScope,
  getRenderer,
  type RenderChild,
  runComponent
} from 'vitarx'
import { diffComponentChange } from './utils.js'

/**
 * 处理组件更新函数
 * @param view - 组件视图对象，包含当前组件的实例和节点信息
 * @param newComponent - 新的组件定义，用于替换现有组件
 */
export function processUpdate(view: ComponentView, newComponent: Component): void {
  // 获取渲染器实例
  const renderer = getRenderer()
  // 创建一个占位符注释节点
  const placeholder = renderer.createComment('')
  // 获取旧组件的DOM元素
  const oldElement = view.node
  // 将占位符插入到旧元素的位置
  renderer.insert(placeholder, oldElement)
  // 获取组件实例
  const instance = view.instance!
  // 比较新旧组件的差异，检查逻辑是否有变化
  const { logic } = diffComponentChange(view.component.toString(), newComponent.toString())
  // 更新视图中的组件引用
  Object.defineProperty(view, 'component', {
    value: newComponent,
    writable: true,
    enumerable: true,
    configurable: true
  })
  // 如果逻辑有变化，则完全重新挂载组件
  if (logic) {
    const ctx = view.ctx
    view.dispose()
    view.init(ctx)
    view.mount(placeholder, 'replace')
    return
  }
  // 销毁旧作用域
  instance.scope.dispose()
  // 清空全部旧生命周期钩子：非 logic 更新不触发任何钩子，钩子注册表始终
  // 等于「最新一次代码执行」的登记——旧钩子既不触发也不累积（对齐 Vue
  // 模板热更新语义）。旧副作用引用的是被 memo/快照保留的同一批响应式
  // 状态，在新视图下依然有效，无需重放生命周期。
  // （hooks 为运行时实例的 @internal 成员，公开类型未声明，此处窄化访问）
  const hookStore = (instance as ComponentInstance & { hooks: Record<string, unknown[]> }).hooks
  for (const hookKey of Object.keys(hookStore)) {
    delete hookStore[hookKey]
  }
  // 重新创建新的作用域
  const scope = new EffectScope({
    name: view.name,
    errorHandler: (error, source) => {
      instance.reportError(error, `effect:${source}`)
    }
  })
  Object.defineProperty(instance, 'scope', {
    value: scope,
    writable: true,
    enumerable: true,
    configurable: true
  })
  // 销毁旧的子树
  instance.subView.dispose()
  // 创建新的子树
  let subView: RenderChild
  try {
    subView = runComponent(instance, () => newComponent(view.props))
  } catch (e) {
    instance.reportError(e, 'component:run')
    subView = createCommentView(`Component<${view.name}>:failed`)
  }
  Object.defineProperty(instance, 'subView', {
    value: instance['normalizeView'](subView),
    writable: true,
    enumerable: true,
    configurable: true
  })
  // 初始化新的子树
  instance.subView.init(instance.subViewContext)
  // 挂载新的子树
  instance.subView.mount(placeholder, 'replace')
}
