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
            // 处理视图更新
            processUpdate(view, this.resolveComponent(view.component))
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
