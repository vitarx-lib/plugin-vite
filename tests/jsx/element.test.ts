import { describe, expect, it } from 'vitest'
import { compile } from '../test-utils.js'

describe('基础元素转换', () => {
  it('转换简单的原生元素', async () => {
    const code = `const App = () => <div></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div");"
    `)
  })

  it('转换带文本子元素的元素', async () => {
    const code = `const App = () => <div>Hello World</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: "Hello World"
      });"
    `)
  })

  it('转换组件元素', async () => {
    const code = `const App = () => <MyComponent />`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView(MyComponent);"
    `)
  })

  it('转换嵌套元素', async () => {
    const code = `const App = () => <div><span>text</span></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */createView("span", {
          children: "text"
        })
      });"
    `)
  })
})

describe('成员表达式组件 (Obj.Key)', () => {
  it('转换 Obj.Key 组件', async () => {
    const code = `const App = () => <Obj.Key />`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView(Obj.Key);"
    `)
  })

  it('转换 Obj.Key 组件带属性和子元素', async () => {
    const code = `const App = () => <Obj.Key value={1}>child</Obj.Key>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView(Obj.Key, {
        "value": 1,
        children: "child"
      });"
    `)
  })

  it('转换三层成员表达式组件 A.B.C', async () => {
    const code = `const App = () => <A.B.C />`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView(A.B.C);"
    `)
  })

  it('Obj.Key 作为子元素', async () => {
    const code = `const App = () => <div><Obj.Key /></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */createView(Obj.Key)
      });"
    `)
  })

  it('Obj.Key 与 v-if 组合', async () => {
    const code = `const App = () => <Obj.Key v-if={show} />`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */branch(() => unref(show) ? 0 : null, [() => /* @__PURE__ */createView(Obj.Key)]);"
    `)
  })

  it('Obj.Key 与 v-show 组合', async () => {
    const code = `const App = () => <Obj.Key v-show={visible} />`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, withDirectives, unref } from "vitarx";
      const App = () => /* @__PURE__ */withDirectives(createView(Obj.Key), [["show", {
        get value() {
          return unref(visible);
        }
      }]]);"
    `)
  })

  it('Obj.Key 在 v-if 链中使用', async () => {
    const code = `const App = () => <>
      <Obj.Key v-if={a}>A</Obj.Key>
      <span v-else>B</span>
    </>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, Fragment, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Fragment, {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */createView(Obj.Key, {
          children: "A"
        }), () => /* @__PURE__ */createView("span", {
          children: "B"
        })])
      });"
    `)
  })
})

describe('children 属性与子元素冲突', () => {
  it('子元素优先于 children 属性', async () => {
    const code = `const App = () => <div children={test}><p /></div>`
    const result = await compile(code)
    expect(result).toContain('createView("p"')
    expect(result).not.toContain('unref(test)')
  })

  it('同时存在时产生警告', async () => {
    const code = `const App = () => <div children={test}><p /></div>`
    const result = await compile(code)
    expect(result).toContain('createView("p"')
  })

  it('仅 children 属性时正常工作', async () => {
    const code = `const App = () => <div children={test} />`
    const result = await compile(code)
    expect(result).toContain('"children": test')
    expect(result).not.toContain('unref')
  })

  it('仅子元素时正常工作', async () => {
    const code = `const App = () => <div><p /></div>`
    const result = await compile(code)
    expect(result).toContain('createView("p"')
  })

  it('多个子元素时合并为数组', async () => {
    const code = `const App = () => <div children={test}><p /><span /></div>`
    const result = await compile(code)
    expect(result).toContain('[/* @__PURE__ */createView("p"')
    expect(result).toContain('createView("span"')
  })
})
