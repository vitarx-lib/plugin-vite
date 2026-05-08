import { describe, expect, it } from 'vitest'
import { compile } from '../test-utils.js'

describe('v-if 连续链', () => {
  it('单独 v-if 生成 branch', async () => {
    const code = `const App = () => <div v-if={show}>visible</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */branch(() => unref(show) ? 0 : null, [() => /* @__PURE__ */createView("div", {
        children: "visible"
      })]);"
    `)
  })

  it('v-if + v-else 在 Fragment 中生成 branch', async () => {
    const code = `const App = () => <>
      <div v-if={show}>visible</div>
      <span v-else>hidden</span>
    </>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, Fragment, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Fragment, {
        children: /* @__PURE__ */branch(() => unref(show) ? 0 : 1, [() => /* @__PURE__ */createView("div", {
          children: "visible"
        }), () => /* @__PURE__ */createView("span", {
          children: "hidden"
        })])
      });"
    `)
  })

  it('v-if + v-else 在普通元素中生成 branch', async () => {
    const code = `const App = () => <div>
      <div v-if={show}>visible</div>
      <span v-else>hidden</span>
    </div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(show) ? 0 : 1, [() => /* @__PURE__ */createView("div", {
          children: "visible"
        }), () => /* @__PURE__ */createView("span", {
          children: "hidden"
        })])
      });"
    `)
  })

  it('v-if + v-else-if + v-else 在 Fragment 中生成 branch', async () => {
    const code = `const App = () => <>
      <div v-if={a}>A</div>
      <span v-else-if={b}>B</span>
      <p v-else>C</p>
    </>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, Fragment, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Fragment, {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : (unref(b) ? 1 : 2), [() => /* @__PURE__ */createView("div", {
          children: "A"
        }), () => /* @__PURE__ */createView("span", {
          children: "B"
        }), () => /* @__PURE__ */createView("p", {
          children: "C"
        })])
      });"
    `)
  })

  it('v-if + v-else-if + v-else 在普通元素中生成 branch', async () => {
    const code = `const App = () => <section>
      <div v-if={a}>A</div>
      <span v-else-if={b}>B</span>
      <p v-else>C</p>
    </section>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView("section", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : (unref(b) ? 1 : 2), [() => /* @__PURE__ */createView("div", {
          children: "A"
        }), () => /* @__PURE__ */createView("span", {
          children: "B"
        }), () => /* @__PURE__ */createView("p", {
          children: "C"
        })])
      });"
    `)
  })

  it('v-if + v-else-if 无 v-else 生成 branch（无兜底分支）', async () => {
    const code = `const App = () => <>
      <div v-if={a}>A</div>
      <span v-else-if={b}>B</span>
    </>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, Fragment, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Fragment, {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : (unref(b) ? 1 : null), [() => /* @__PURE__ */createView("div", {
          children: "A"
        }), () => /* @__PURE__ */createView("span", {
          children: "B"
        })])
      });"
    `)
  })

  it('多个 v-else-if 分支生成嵌套条件', async () => {
    const code = `const App = () => <>
      <div v-if={a}>A</div>
      <span v-else-if={b}>B</span>
      <p v-else-if={c}>C</p>
      <em v-else>D</em>
    </>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, Fragment, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Fragment, {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : (unref(b) ? 1 : (unref(c) ? 2 : 3)), [() => /* @__PURE__ */createView("div", {
          children: "A"
        }), () => /* @__PURE__ */createView("span", {
          children: "B"
        }), () => /* @__PURE__ */createView("p", {
          children: "C"
        }), () => /* @__PURE__ */createView("em", {
          children: "D"
        })])
      });"
    `)
  })

  it('嵌套 v-if 链各自独立处理', async () => {
    const code = `const App = () => <>
      <div v-if={outer}>outer</div>
      <span v-else>
        <p v-if={inner}>inner</p>
        <strong v-else>fallback</strong>
      </span>
    </>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, Fragment, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Fragment, {
        children: /* @__PURE__ */branch(() => unref(outer) ? 0 : 1, [() => /* @__PURE__ */createView("div", {
          children: "outer"
        }), () => /* @__PURE__ */createView("span", {
          children: /* @__PURE__ */branch(() => unref(inner) ? 0 : 1, [() => /* @__PURE__ */createView("p", {
            children: "inner"
          }), () => /* @__PURE__ */createView("strong", {
            children: "fallback"
          })])
        })])
      });"
    `)
  })

  it('同一父级中多个独立 v-if 链', async () => {
    const code = `const App = () => <>
      <div v-if={a}>A</div>
      <span v-else>not A</span>
      <p v-if={b}>B</p>
      <em v-else>not B</em>
    </>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, Fragment, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Fragment, {
        children: [/* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */createView("div", {
          children: "A"
        }), () => /* @__PURE__ */createView("span", {
          children: "not A"
        })]), /* @__PURE__ */branch(() => unref(b) ? 0 : 1, [() => /* @__PURE__ */createView("p", {
          children: "B"
        }), () => /* @__PURE__ */createView("em", {
          children: "not B"
        })])]
      });"
    `)
  })

  it('v-if 链与非链子元素共存', async () => {
    const code = `const App = () => <div>
      <h1>title</h1>
      <p v-if={show}>visible</p>
      <span v-else>hidden</span>
      <footer>end</footer>
    </div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: [/* @__PURE__ */createView("h1", {
          children: "title"
        }), /* @__PURE__ */branch(() => unref(show) ? 0 : 1, [() => /* @__PURE__ */createView("p", {
          children: "visible"
        }), () => /* @__PURE__ */createView("span", {
          children: "hidden"
        })]), /* @__PURE__ */createView("footer", {
          children: "end"
        })]
      });"
    `)
  })

  it('v-if + v-else 混合其他指令', async () => {
    const code = `const App = () => <>
      <div v-if={b} v-show={a}>text</div>
    </>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, Fragment, branch, withDirectives, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Fragment, {
        children: /* @__PURE__ */branch(() => unref(b) ? 0 : null, [() => /* @__PURE__ */withDirectives(createView("div", {
          children: "text"
        }), [["show", {
          get value() {
            return unref(a);
          }
        }]])])
      });"
    `)
  })

  it('v-if + v-else 两个分支都有其他指令', async () => {
    const code = `const App = () => <>
      <div v-if={a} v-show={x}>A</div>
      <span v-else v-show={y}>B</span>
    </>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, Fragment, branch, withDirectives, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Fragment, {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */withDirectives(createView("div", {
          children: "A"
        }), [["show", {
          get value() {
            return unref(x);
          }
        }]]), () => /* @__PURE__ */withDirectives(createView("span", {
          children: "B"
        }), [["show", {
          get value() {
            return unref(y);
          }
        }]])])
      });"
    `)
  })

  it('v-else 无前置 v-if 抛出 E003 错误', async () => {
    const code = `const App = () => <div v-else>text</div>`
    await expect(compile(code)).rejects.toThrow('[E003]')
  })

  it('v-else-if 无前置 v-if 抛出 E004 错误', async () => {
    const code = `const App = () => <>
      <div v-else-if={b}>text</div>
    </>`
    await expect(compile(code)).rejects.toThrow('[E004]')
  })

  it('v-else 在普通元素中无前置 v-if 抛出 E003 错误', async () => {
    const code = `const App = () => <div>
      <span v-else>text</span>
    </div>`
    await expect(compile(code)).rejects.toThrow('[E003]')
  })

  it('v-else-if 在普通元素中无前置 v-if 抛出 E004 错误', async () => {
    const code = `const App = () => <div>
      <span v-else-if={b}>text</span>
    </div>`
    await expect(compile(code)).rejects.toThrow('[E004]')
  })
})
