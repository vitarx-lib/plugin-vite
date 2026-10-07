/**
 * WeakRef 视图集合工具单元测试
 *
 * 剪枝/去重逻辑为纯函数，接受 WeakRefLike 结构类型——用伪引用做
 * 确定性断言（真实 WeakRef 的 deref 时点依赖 GC，无法在单测中确定触发）。
 */
import { describe, expect, it } from 'vitest'
import type { ComponentView } from 'vitarx'
import {
  collectLiveViews,
  registerViewRef,
  type WeakRefLike
} from '../../src/hmr-client/weak-refs.js'

/** 构造伪视图（仅用作集合元素，不参与渲染） */
const fakeView = (tag: string): ComponentView => ({ '#fake': tag }) as unknown as ComponentView

/** 死引用：deref 恒为 undefined（模拟视图已被 GC 回收） */
const deadRef = (): WeakRefLike<ComponentView> => ({ deref: () => undefined })

/** 活引用：持有个体强引用（模拟挂载中/Freeze 缓存中的视图） */
const liveRef = (view: ComponentView): WeakRefLike<ComponentView> => ({ deref: () => view })

describe('registerViewRef', () => {
  it('同一视图重复登记去重（WeakRef 身份 ≠ 视图身份）', () => {
    const refs = new Set<WeakRefLike<ComponentView>>()
    const view = fakeView('a')
    registerViewRef(refs, view)
    registerViewRef(refs, view)
    registerViewRef(refs, view)
    // 集合中只有 1 个引用，且解引用到同一视图
    expect(refs.size).toBe(1)
    expect([...refs][0]!.deref()).toBe(view)
  })

  it('不同视图各自登记，互不吞并', () => {
    const refs = new Set<WeakRefLike<ComponentView>>()
    const a = fakeView('a')
    const b = fakeView('b')
    registerViewRef(refs, a)
    registerViewRef(refs, b)
    expect(refs.size).toBe(2)
  })

  it('登记时顺带剪枝死引用', () => {
    const refs = new Set<WeakRefLike<ComponentView>>([deadRef(), deadRef()])
    registerViewRef(refs, fakeView('fresh'))
    expect(refs.size).toBe(1)
  })
})

describe('collectLiveViews', () => {
  it('返回存活视图，原地剪枝死引用', () => {
    const live1 = fakeView('live1')
    const live2 = fakeView('live2')
    const refs = new Set<WeakRefLike<ComponentView>>([
      deadRef(),
      liveRef(live1),
      deadRef(),
      liveRef(live2)
    ])
    const result = collectLiveViews(refs)
    expect(result).toEqual([live1, live2])
    // 死引用已被移出集合
    expect(refs.size).toBe(2)
  })

  it('全死引用集合剪枝后为空', () => {
    const refs = new Set<WeakRefLike<ComponentView>>([deadRef(), deadRef()])
    expect(collectLiveViews(refs)).toEqual([])
    expect(refs.size).toBe(0)
  })
})
