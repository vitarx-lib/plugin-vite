import { Component, ComponentView, isComponent, isReactive, isRef } from 'vitarx'
import type { ModuleNamespace } from 'vite/types/hot.js'
import { HMR } from '../constants/index.js'
import { processUpdate } from './update.js'

declare global {
  interface Window {
    [HMR.manager]: HMRManager
  }
}
declare module 'vitarx' {
  interface ComponentView {
    [HMR.state]?: Record<string, any>
  }
}

/**
 * HMR管理器
 *
 * 此管理器负责管理模块和组件的映射关系，并在模块更新时，更新对应的组件。
 */
export default class HMRManager {
  /**
   * id模块映射到组件虚拟节点集合
   *
   * 模块id -> 组件虚拟节点
   */
  #idMapToView: Map<string, Set<ComponentView>> = new Map()
  /**
   * id映射到组件构造函数
   */
  #idMapToComponent = new Map<string, Component>()
  /**
   * 视图状态 getter 登记表
   *
   * 组件函数每次执行时通过 trackState 登记当前作用域状态的惰性读取器，
   * 热更新时读取一次生成快照；视图销毁/重挂载不会保留，避免旧状态泄漏。
   */
  #viewStateGetters = new WeakMap<ComponentView, Record<string, () => any>>()
  /**
   * 获取单实例
   */
  static get instance(): HMRManager {
    if (!window[HMR.manager]) {
      window[HMR.manager] = new HMRManager()
    }
    return window[HMR.manager]
  }
  /**
   * 给组件绑定唯一id
   *
   * @param component
   * @param id
   */
  bindId(component: Function, id: string) {
    if (typeof component === 'function') {
      Object.defineProperty(component, HMR.id, { value: id })
    }
  }
  /**
   * 置换新组件
   *
   * 此方法提供给`createView`函数调用，保持每次创建组件实例都是最新的模块！
   *
   * @param component - 组件构造函数
   */
  resolveComponent(component: Component): Component {
    const id = this.getId(component)
    return id ? (this.#idMapToComponent.get(id) ?? component) : component
  }
  /**
   * 恢复状态
   *
   * @param {ComponentView} view - 组件视图
   * @param {string} name - 变量名称
   * @example
   * const state = __$VITARX_HMR$__.instance.memo(__$VITARX_HMR_VIEW_NODE$__, 'state') ?? ref(0)
   */
  memo(view: ComponentView, name: string): any {
    if (!view) return undefined
    const state = view[HMR.state]?.[name]
    // 如果是副作用，则丢弃。
    if (!isRef(state) && !isReactive(state)) return undefined
    return state
  }
  /**
   * 无条件恢复状态（不做 Ref/reactive 门禁）
   *
   * 供解构声明的隐藏变量使用：composable 返回的控制器是普通对象
   * （内含 Ref 与函数），memo 的响应式门禁会将其拒收导致恢复永远
   * 落空。仅限转换器为解构声明生成的代码调用。
   *
   * @param {ComponentView} view - 组件视图
   * @param {string} name - 变量名称
   */
  memoRaw(view: ComponentView, name: string): any {
    if (!view) return undefined
    return view[HMR.state]?.[name]
  }
  /**
   * 注册节点
   *
   * @param view - 组件视图节点
   * @param component - 组件构造函数
   */
  register(view: ComponentView, component?: Component): void {
    if (!view) return
    component ??= view.component
    const id = this.getId(component)
    if (this.#idMapToView.has(id)) {
      this.#idMapToView.get(id)!.add(view)
    } else {
      this.#idMapToView.set(id, new Set([view]))
    }
  }
  /**
   * 获取组件的唯一id
   *
   * @param component - 组件构造函数
   */
  getId(component: Component): string {
    return Reflect.get(component, HMR.id)
  }
  /**
   * 登记视图状态 getter
   *
   * 由转换器注入的代码在组件函数每次执行时调用，登记当前作用域的
   * 惰性状态读取器（同一视图重复登记覆盖旧的）。读取动作延迟到
   * 热更新快照时发生，正常挂载/重挂载不会产生任何状态残留。
   *
   * @param {ComponentView} view - 组件视图
   * @param {Record<string, () => any>} getters - 变量名到读取器的映射
   */
  trackState(view: ComponentView, getters: Record<string, () => any>): void {
    if (!view) return
    this.#viewStateGetters.set(view, getters)
  }
  /**
   * 生成视图状态快照并写入视图，供热更新重执行时 memo 恢复
   *
   * @param {ComponentView} view - 组件视图
   */
  #snapshotState(view: ComponentView): void {
    const getters = this.#viewStateGetters.get(view)
    if (!getters) return
    const snapshot: Record<string, any> = {}
    for (const name in getters) {
      try {
        // 注意：getters 是 getter 属性对象——读取属性即执行 getter 并返回值，
        // 不能再加调用括号（否则会把返回值当函数调用，全部抛 TypeError）
        const value: any = getters[name]
        // 防御：函数值（旧编译产物仍可能登记函数变量）不进入快照，
        // 绝不调用组件内的业务函数
        if (typeof value === 'function') continue
        snapshot[name] = value
      } catch {
        // 单个变量读取失败（如暂时性死区）不影响其余状态恢复
      }
    }
    view[HMR.state] = snapshot
  }
  /**
   * 模块更新
   *
   * @param newModule - 新模块对象
   */
  update(newModule: ModuleNamespace): void {
    if (!newModule) return
    try {
      const components: Component[] = []
      const updatedView = new Set<ComponentView>()
      // 先遍历模块更新id->component映射
      for (const modKey in newModule) {
        // 新组件
        const newComponent = newModule[modKey]
        // 如果不是组件则跳过
        if (!isComponent(newComponent)) continue
        // 更新模块
        const id = this.getId(newComponent)
        if (id) {
          this.#idMapToComponent.set(id, newComponent)
          components.push(newComponent)
        }
      }
      for (const component of components) {
        const id = this.getId(component)
        // 模块活跃的虚拟节点集合
        const views = this.#idMapToView.get(id)
        if (!views) continue
        // 遍历关联的所有视图，使其更新
        for (const view of views) {
          // 跳过已更新过的视图，避免同一次更新中同一个视图被更新多次
          if (updatedView.has(view)) continue
          // 仅在视图是活跃状态，且已挂载时才更新
          if (view.isActive && view.isMounted) {
            // 重执行前快照当前状态，使组件函数重执行时 memo 命中、保留状态
            this.#snapshotState(view)
            try {
              // 处理视图更新
              processUpdate(view, this.resolveComponent(view.component))
            } finally {
              // 快照仅服务于本次热更新，用完即清——
              // 保证后续正常的「卸载→重挂载」拿到全新状态，与生产行为一致
              delete view[HMR.state]
            }
            // 标记视图已更新
            updatedView.add(view)
          }
        }
      }
    } catch (e) {
      if (import.meta.hot) {
        import.meta.hot.invalidate(`[VitarxHMR]: ${e}`)
      } else {
        throw e
      }
    }
  }
}
