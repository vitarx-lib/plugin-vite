// @vitest-environment happy-dom
/**
 * processUpdate 运行时行为集成测试
 *
 * 锁定统一重挂载语义的运行时契约（编译产物形状测试无法覆盖的部分）：
 * 1. 任何更新都完整卸载重建：onDispose/onScopeDispose 在 onMounted 之前触发，
 *    且每次更新恰好一轮（钩子无滞留、无重复累积）
 * 2. update 后组件重执行，provide 链完整、inject 可解析
 *    （锁定 ctx 必须在 dispose 之前捕获的顺序契约，回归 33046d7）
 * 3. 状态经快照/memo 保留：重执行命中同一 ref 实例，值随旧 ref 携带
 *
 * 组件体内的 trackState/register 调用模拟转换器注入的真实产物代码；
 * 组件不经 JSX 编译（h() 手写视图），避免对编译插件的依赖。
 */
import { describe, expect, it } from 'vitest'
import type { ModuleNamespace } from 'vite/types/hot.js'
import {
  createApp,
  getComponentView,
  h,
  inject,
  onDispose,
  onMounted,
  onScopeDispose,
  ref,
  render,
  type Ref
} from 'vitarx'
import HMRManager from '../../src/hmr-client/index.js'

/** provide 注入键 */
const TOKEN = Symbol('test-provide')
/** 组件 HMR 唯一 id */
const CHILD_ID = 'hmr-update-test-child'

/** 探针采集器：收集钩子日志、历次执行的 ref 实例与 inject 结果 */
interface Probe {
  log: string[]
  captured: Ref<number>[]
  injected: string[]
}

function createProbe(): Probe {
  return { log: [], captured: [], injected: [] }
}

/**
 * 创建探针子组件（完整模拟转换器注入后的产物形态）：
 * 登记语句（视图节点 + register + trackState）位于函数体顶部，
 * 声明经 memo(view, 'count') ?? ref(0) 包装——与真实编译产物一致
 */
function createChild(version: string, probe: Probe) {
  const Child = (): any => {
    const activeView = getComponentView(true)
    // 真实组件上下文中视图恒存在；测试防御性兜底，不参与断言
    if (!activeView) return h('div', 'no-active-view')
    HMRManager.instance.register(activeView)
    // 惰性 getter：登记时 count 尚未声明，快照时才读取（与真实注入一致）。
    // 必须用 getter 属性形态（转换器产物即如此）——若写成箭头函数属性，
    // #snapshotState 的函数值防御会将其跳过，快照为空
    HMRManager.instance.trackState(activeView, {
      get count() {
        return count
      }
    })
    const count = HMRManager.instance.memo(activeView, 'count') ?? ref(0)
    probe.captured.push(count)
    probe.injected.push(inject(TOKEN, 'inject-fallback'))
    onDispose(() => probe.log.push(`dispose:${version}`))
    onScopeDispose(() => probe.log.push(`scopeDispose:${version}`))
    onMounted(() => probe.log.push(`mounted:${version}`))
    return h('div', { class: 'hmr-probe' }, [`count=${count.value}`])
  }
  return Child
}

describe('processUpdate 统一重挂载语义（运行时契约）', () => {
  it('更新完整卸载重建：钩子按序触发、inject 可解析、状态经快照保留', () => {
    const probe = createProbe()
    const ChildV1 = createChild('v1', probe)
    HMRManager.instance.bindId(ChildV1, CHILD_ID)

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(() => h('div'))
    app.provide(TOKEN, 'from-app')

    const view = render(ChildV1, host, { app })
    // 初始挂载：仅 mounted，inject 经 ctx 链解析到应用级 provide
    expect(probe.log).toEqual(['mounted:v1'])
    expect(probe.injected).toEqual(['from-app'])
    expect(host.querySelector('.hmr-probe')).not.toBeNull()

    // 变更状态，验证跨更新保留（同一 ref 实例携带值）
    probe.captured[0]!.value = 5

    // 模拟模块热更新：新版本组件绑定同一 id，经 update() 走完整管线
    // （快照 → processUpdate → 删除快照）
    const ChildV2 = createChild('v2', probe)
    HMRManager.instance.bindId(ChildV2, CHILD_ID)
    const newModule = {
      [Symbol.toStringTag]: 'Module',
      Child: ChildV2
    } as ModuleNamespace
    HMRManager.instance.update(newModule)

    // ① 卸载重建：dispose/onScopeDispose 先于 mounted，且恰好一轮
    //    （钩子无滞留、无重复累积）
    expect(probe.log).toEqual(['mounted:v1', 'dispose:v1', 'scopeDispose:v1', 'mounted:v2'])
    // ② ctx 在 dispose 前捕获 → 重执行时 provide 链完整，inject 仍解析
    //    （回归锁定：ctx 在 dispose 后读取时此值为 'inject-fallback'）
    expect(probe.injected).toEqual(['from-app', 'from-app'])
    // ③ 状态保留：重执行 memo 命中同一 ref 实例，值随旧 ref 携带
    expect(probe.captured[1]).toBe(probe.captured[0])
    expect(probe.captured[1]!.value).toBe(5)

    view.dispose()
    host.remove()
  })

  it('update 返回值语义：模块含已绑定 id 的组件返回 true，否则 false', () => {
    const manager = HMRManager.instance

    // 无 id 组件：转发目标不可识别，调用方应 invalidate 兜底
    const anonymous = (): string => 'no-id'
    expect(manager.update({ Child: anonymous } as unknown as ModuleNamespace)).toBe(false)

    // 已绑定 id 但无活跃视图（组件未挂载）：映射已刷新，仍算可识别
    const bound = (): string => 'bound'
    manager.bindId(bound, 'hmr-update-ret-bound-id')
    expect(manager.update({ Child: bound } as unknown as ModuleNamespace)).toBe(true)

    // 空模块/空值
    expect(manager.update(undefined as unknown as ModuleNamespace)).toBe(false)
  })

  it('register 重复登记同一视图去重：update 仅触发一轮卸载重建', () => {
    const probe = createProbe()
    const ChildV1 = createChild('v1', probe)
    HMRManager.instance.bindId(ChildV1, 'hmr-update-dedup-child')

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(() => h('div'))
    const view = render(ChildV1, host, { app })

    // 模拟组件重复执行（每次执行都会 register 同一 view）：
    // register 的真实视图来自组件上下文，这里再手动登记两次
    const ChildV2 = createChild('v2', probe)
    HMRManager.instance.bindId(ChildV2, 'hmr-update-dedup-child')
    const activeView = view as unknown as Parameters<typeof HMRManager.instance.register>[0]
    HMRManager.instance.register(activeView)
    HMRManager.instance.register(activeView)

    HMRManager.instance.update({ Child: ChildV2 } as unknown as ModuleNamespace)

    // 若去重失效，同一视图会被多次 processUpdate，日志将出现成倍的 dispose/mounted
    expect(probe.log).toEqual(['mounted:v1', 'dispose:v1', 'scopeDispose:v1', 'mounted:v2'])

    view.dispose()
    host.remove()
  })
})
