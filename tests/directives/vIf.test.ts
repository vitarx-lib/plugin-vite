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
})

describe('嵌套 v-if 链', () => {
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

  it('IfBlock 内嵌套 v-if 链', async () => {
    const code = `const App = () => (
      <IfBlock>
        <div v-if={a}>A<div v-if={b}>B</div><span v-else>C</span></div>
        <p v-else>D</p>
      </IfBlock>
    )`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */createView("div", {
        children: ["A", /* @__PURE__ */branch(() => unref(b) ? 0 : 1, [() => /* @__PURE__ */createView("div", {
          children: "B"
        }), () => /* @__PURE__ */createView("span", {
          children: "C"
        })])]
      }), () => /* @__PURE__ */createView("p", {
        children: "D"
      })]);"
    `)
  })

  it('三层嵌套 v-if 链', async () => {
    const code = `const App = () => <div>
      <div v-if={a}><div v-if={b}><div v-if={c}>deep</div><span v-else>shallow</span></div></div>
    </div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : null, [() => /* @__PURE__ */createView("div", {
          children: /* @__PURE__ */branch(() => unref(b) ? 0 : null, [() => /* @__PURE__ */createView("div", {
            children: /* @__PURE__ */branch(() => unref(c) ? 0 : 1, [() => /* @__PURE__ */createView("div", {
              children: "deep"
            }), () => /* @__PURE__ */createView("span", {
              children: "shallow"
            })])
          })])
        })])
      });"
    `)
  })
})

describe('v-if 链与容器类型', () => {
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

  it('普通元素中多个独立 v-if 链', async () => {
    const code = `const App = () => <div>
      <div v-if={a}>A</div><span v-else>B</span>
      <em v-if={c}>C</em><strong v-else>D</strong>
    </div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: [/* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */createView("div", {
          children: "A"
        }), () => /* @__PURE__ */createView("span", {
          children: "B"
        })]), /* @__PURE__ */branch(() => unref(c) ? 0 : 1, [() => /* @__PURE__ */createView("em", {
          children: "C"
        }), () => /* @__PURE__ */createView("strong", {
          children: "D"
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

  it('Fragment 内 v-if 链后跟非链元素', async () => {
    const code = `const App = () => <>
      <div v-if={a}>A</div><span v-else>B</span><p>always</p>
    </>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, Fragment, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Fragment, {
        children: [/* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */createView("div", {
          children: "A"
        }), () => /* @__PURE__ */createView("span", {
          children: "B"
        })]), /* @__PURE__ */createView("p", {
          children: "always"
        })]
      });"
    `)
  })

  it('组件子元素中的 v-if 链', async () => {
    const code = `const App = () => <Wrapper>
      <div v-if={a}>A</div><span v-else>B</span>
    </Wrapper>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView(Wrapper, {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */createView("div", {
          children: "A"
        }), () => /* @__PURE__ */createView("span", {
          children: "B"
        })])
      });"
    `)
  })
})

describe('v-if 链与其他指令组合', () => {
  it('v-if + v-show 单独使用', async () => {
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

  it('v-if + v-else 两个分支都有 v-show', async () => {
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

  it('v-if 链每个分支都有 v-show（在普通元素子元素中）', async () => {
    const code = `const App = () => <div>
      <span v-if={a} v-show={b}>A</span>
      <em v-else-if={c} v-show={d}>B</em>
      <p v-else v-show={e}>C</p>
    </div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, withDirectives, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : (unref(c) ? 1 : 2), [() => /* @__PURE__ */withDirectives(createView("span", {
          children: "A"
        }), [["show", {
          get value() {
            return unref(b);
          }
        }]]), () => /* @__PURE__ */withDirectives(createView("em", {
          children: "B"
        }), [["show", {
          get value() {
            return unref(d);
          }
        }]]), () => /* @__PURE__ */withDirectives(createView("p", {
          children: "C"
        }), [["show", {
          get value() {
            return unref(e);
          }
        }]])])
      });"
    `)
  })

  it('v-if + v-model 组合', async () => {
    const code = `const App = () => <Input v-if={a} v-model={value} />`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */branch(() => unref(a) ? 0 : null, [() => /* @__PURE__ */createView(Input, {
        get modelValue() {
          return unref(value);
        },
        "onUpdate:modelValue": v => {
          value.value = v;
        }
      })]);"
    `)
  })
})

describe('v-if 命名空间语法', () => {
  it('v:if 单独使用', async () => {
    const code = `const App = () => <div v:if={show}>visible</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, unref } from "vitarx";
      const App = () => /* @__PURE__ */branch(() => unref(show) ? 0 : null, [() => /* @__PURE__ */createView("div", {
        children: "visible"
      })]);"
    `)
  })

  it('v:if + v:else 命名空间语法', async () => {
    const code = `const App = () => <>
      <div v:if={show}>visible</div>
      <span v:else>hidden</span>
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
})

describe('v-if 链错误处理', () => {
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

  it('v-if 链中间有非空白文本时 v-else 报错', async () => {
    const code = `const App = () => <>
      <div v-if={a}>A</div>text between<span v-else>B</span>
    </>`
    await expect(compile(code)).rejects.toThrow('[E003]')
  })
})
