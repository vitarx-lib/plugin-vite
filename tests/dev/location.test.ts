import { describe, expect, it } from 'vitest'
import { compile, defaultOptions, devOptions } from '../test-utils.js'

describe('Dev 模式', () => {
  it('dev 模式 createView 注入位置信息', async () => {
    const code = `const App = () => <div></div>`
    const result = await compile(code, devOptions)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", null, {
        fileName: "/test.tsx",
        lineNumber: 1,
        columnNumber: 19
      });"
    `)
  })

  it('dev 模式嵌套元素 createView 注入位置信息', async () => {
    const code = `const App = () => <div><span></span></div>`
    const result = await compile(code, devOptions)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */createView("span", null, {
          fileName: "/test.tsx",
          lineNumber: 1,
          columnNumber: 24
        })
      }, {
        fileName: "/test.tsx",
        lineNumber: 1,
        columnNumber: 19
      });"
    `)
  })

  it('dev 模式 branch 调用不注入位置信息', async () => {
    const code = `const App = () => <div v-if={show}>visible</div>`
    const result = await compile(code, devOptions)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */branch(() => unref(show) ? 0 : null, [() => /* @__PURE__ */createView("div", {
        children: "visible"
      }, {
        fileName: "/test.tsx",
        lineNumber: 1,
        columnNumber: 19
      })]);"
    `)
  })

  it('dev 模式 expr 调用不注入位置信息', async () => {
    const code = `const App = () => <div>{a && b}</div>`
    const result = await compile(code, devOptions)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => a && b)
      }, {
        fileName: "/test.tsx",
        lineNumber: 1,
        columnNumber: 19
      });"
    `)
  })

  it('生产模式 createView 不注入位置信息', async () => {
    const code = `const App = () => <div></div>`
    const result = await compile(code, defaultOptions)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div");"
    `)
  })

  it('生产模式 expr 调用不注入位置信息', async () => {
    const code = `const App = () => <div>{a && b}</div>`
    const result = await compile(code, defaultOptions)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => a && b)
      });"
    `)
  })
})
