import { describe, expect, it } from 'vitest'
import { compile } from '../test-utils.js'

/**
 * ref 属性特殊处理测试
 *
 * 背景：
 * `ref` 是 vitarx 的内置特殊属性（与 children 同级），用于获取 DOM 元素或组件实例引用。
 * 运行时 resolveProps() 通过 isRef() 判定 ref 属性值是否为 ref 对象：
 *   - 是 ref 对象 → 挂载时执行 ref.value = hostNode，绑定生效
 *   - 非 ref 对象 → 绑定失效，ref.value 永远为 null
 *
 * Bug 场景：
 * createProperty() 未对 `ref` 属性做特殊处理，将其与普通属性一视同仁：
 *   - ref 变量（ref/shallowRef/computed 创建）→ 生成 get ref() { return var.value } → 解包后为 null
 *   - 普通标识符（useRef 等）→ 生成 get ref() { return unref(var) } → 解包后为 null
 * 两种情况都导致 isRef() 判定失败，ref 绑定完全失效。
 *
 * 修复方案：
 * `ref` 属性应与 `children` 同等处理——直接赋值标识符本身，不做 unref/.value 解包。
 */
describe('ref 属性应直接赋值标识符本身（不解包）', () => {
  it('useRef 创建的变量直接赋值（不 unref）', async () => {
    // useRef 不在 REF_APIS 中，变量不会被识别为 refVariables，
    // 修复前会走 createUnrefGetter 生成 unref(divRef)，导致 isRef(null) 失败
    const code = `import { useRef } from 'vitarx'; const divRef = useRef(); const App = () => <div ref={divRef}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { useRef, createView } from 'vitarx';
      const divRef = useRef();
      const App = () => /* @__PURE__ */createView("div", {
        "ref": divRef
      });"
    `)
  })

  it('ref() 创建的变量直接赋值（不 .value）', async () => {
    // ref 在 REF_APIS 中，变量会被识别为 refVariables，
    // 修复前会走 createGetter 生成 divRef.value，导致 isRef(解包值) 失败
    const code = `import { ref } from 'vitarx'; const divRef = ref(null); const App = () => <div ref={divRef}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { ref, createView } from 'vitarx';
      const divRef = ref(null);
      const App = () => /* @__PURE__ */createView("div", {
        "ref": divRef
      });"
    `)
  })

  it('shallowRef() 创建的变量直接赋值（不 .value）', async () => {
    const code = `import { shallowRef } from 'vitarx'; const divRef = shallowRef(null); const App = () => <div ref={divRef}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { shallowRef, createView } from 'vitarx';
      const divRef = shallowRef(null);
      const App = () => /* @__PURE__ */createView("div", {
        "ref": divRef
      });"
    `)
  })

  it('computed 创建的变量直接赋值（不 .value）', async () => {
    const code = `import { computed } from 'vitarx'; const divRef = computed(() => null); const App = () => <div ref={divRef}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { computed, createView } from 'vitarx';
      const divRef = computed(() => null);
      const App = () => /* @__PURE__ */createView("div", {
        "ref": divRef
      });"
    `)
  })

  it('非 ref API 创建的普通变量直接赋值（不 unref）', async () => {
    // 既不在 refVariables 也不在 nonRefVariables 的普通变量，
    // 修复前会走 createUnrefGetter 生成 unref(divRef)
    const code = `const divRef = getRef(); const App = () => <div ref={divRef}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const divRef = getRef();
      const App = () => /* @__PURE__ */createView("div", {
        "ref": divRef
      });"
    `)
  })
})

describe('ref 属性的回调函数形式保持直接赋值（回归保护）', () => {
  it('内联箭头函数直接赋值', async () => {
    // 箭头函数是静态值，本来就走 objectProperty 直接赋值，此处确保修复不破坏此行为
    const code = `const App = () => <div ref={(el) => { console.log(el) }}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "ref": el => {
          console.log(el);
        }
      });"
    `)
  })

  it('函数声明变量直接赋值', async () => {
    // 函数声明在 nonRefVariables 中，本来就走 objectProperty 直接赋值
    const code = `function handleRef(el) {} const App = () => <div ref={handleRef}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      function handleRef(el) {}
      const App = () => /* @__PURE__ */createView("div", {
        "ref": handleRef
      });"
    `)
  })

  it('箭头函数变量直接赋值', async () => {
    const code = `const handleRef = () => {}; const App = () => <div ref={handleRef}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const handleRef = () => {};
      const App = () => /* @__PURE__ */createView("div", {
        "ref": handleRef
      });"
    `)
  })
})

describe('回归测试：非 ref 属性仍正常解包', () => {
  it('ref 变量作为普通属性仍使用 .value', async () => {
    const code = `import { ref } from 'vitarx'; const count = ref(0); const App = () => <div count={count}></div>`
    const result = await compile(code)
    expect(result).toContain('count.value')
    expect(result).not.toContain('"count": count')
  })

  it('普通变量作为普通属性仍使用 unref', async () => {
    const code = `const count = getValue(); const App = () => <div count={count}></div>`
    const result = await compile(code)
    expect(result).toContain('unref(count)')
  })

  it('useRef 变量作为普通属性仍使用 unref', async () => {
    const code = `import { useRef } from 'vitarx'; const el = useRef(); const App = () => <div data-el={el}></div>`
    const result = await compile(code)
    expect(result).toContain('unref(el)')
  })

  it('同一元素上 ref 属性直接赋值、其他属性正常解包', async () => {
    const code = `import { ref } from 'vitarx'; const divRef = ref(null); const cls = ref('a'); const App = () => <div ref={divRef} class={cls}></div>`
    const result = await compile(code)
    // ref 属性直接赋值
    expect(result).toContain('"ref": divRef')
    expect(result).not.toContain('unref(divRef)')
    // class 属性仍走 .value 解包
    expect(result).toContain('cls.value')
  })
})
