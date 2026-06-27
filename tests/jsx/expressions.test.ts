import { describe, expect, it } from 'vitest'
import { compile } from '../test-utils.js'

describe('嵌套三元表达式', () => {
  it('两层嵌套三元 - 两个条件三个分支', async () => {
    const code = `const App = () => <div>{show ? <span>yes</span> : show2 ? <span>maybe</span> : <span>no</span>}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(show) ? 0 : 1, [() => /* @__PURE__ */createView("span", {
          children: "yes"
        }), () => /* @__PURE__ */branch(() => unref(show2) ? 0 : 1, [() => /* @__PURE__ */createView("span", {
          children: "maybe"
        }), () => /* @__PURE__ */createView("span", {
          children: "no"
        })])])
      });"
    `)
  })

  it('三层嵌套三元 - 三个条件四个分支', async () => {
    const code = `const App = () => <div>{a ? 'A' : b ? 'B' : c ? 'C' : 'D'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => 'A', () => /* @__PURE__ */branch(() => unref(b) ? 0 : 1, [() => 'B', () => /* @__PURE__ */branch(() => unref(c) ? 0 : 1, [() => 'C', () => 'D'])])])
      });"
    `)
  })

  it('嵌套三元 - consequent 分支中嵌套', async () => {
    const code = `const App = () => <div>{a ? b ? 'AB' : 'A' : 'other'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */branch(() => unref(b) ? 0 : 1, [() => 'AB', () => 'A']), () => 'other'])
      });"
    `)
  })

  it('嵌套三元 - 两层均为 JSX 元素', async () => {
    const code = `const App = () => <div>{a ? <span>A</span> : b ? <span>B</span> : <span>C</span>}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */createView("span", {
          children: "A"
        }), () => /* @__PURE__ */branch(() => unref(b) ? 0 : 1, [() => /* @__PURE__ */createView("span", {
          children: "B"
        }), () => /* @__PURE__ */createView("span", {
          children: "C"
        })])])
      });"
    `)
  })

  it('嵌套三元 - alternate 为逻辑表达式', async () => {
    const code = `const App = () => <div>{a ? <span>A</span> : b || c}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */createView("span", {
          children: "A"
        }), () => /* @__PURE__ */expr(() => b || c)])
      });"
    `)
  })

  it('嵌套三元 - consequent 为逻辑表达式', async () => {
    const code = `const App = () => <div>{a ? b && c : <span>other</span>}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */expr(() => b && c), () => /* @__PURE__ */createView("span", {
          children: "other"
        })])
      });"
    `)
  })

  it('嵌套三元 - alternate 为函数调用表达式', async () => {
    const code = `const App = () => <div>{a ? <span>A</span> : createContent()}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */createView("span", {
          children: "A"
        }), () => /* @__PURE__ */expr(() => createContent())])
      });"
    `)
  })

  it('嵌套三元 - consequent 为函数调用表达式', async () => {
    const code = `const App = () => <div>{a ? createContent() : <span>B</span>}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */expr(() => createContent()), () => /* @__PURE__ */createView("span", {
          children: "B"
        })])
      });"
    `)
  })

  it('嵌套三元 - 两个分支均为函数调用', async () => {
    const code = `const App = () => <div>{a ? renderA() : renderB()}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => /* @__PURE__ */expr(() => renderA()), () => /* @__PURE__ */expr(() => renderB())])
      });"
    `)
  })

  it('嵌套三元 - 分支为 MemberExpression', async () => {
    const code = `const App = () => <div>{a ? props.content : <span>default</span>}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, accessor } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => accessor(props, "content"), () => /* @__PURE__ */createView("span", {
          children: "default"
        })])
      });"
    `)
  })
})

describe('复杂表达式边界情况', () => {
  it('三元条件为逻辑与表达式', async () => {
    const code = `const App = () => <div>{a && b ? 'yes' : 'no'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => (a && b) ? 0 : 1, [() => 'yes', () => 'no'])
      });"
    `)
  })

  it('三元条件为二元表达式', async () => {
    const code = `const App = () => <div>{count > 0 ? 'positive' : 'non-positive'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => count > 0 ? 0 : 1, [() => 'positive', () => 'non-positive'])
      });"
    `)
  })

  it('三元条件为成员表达式', async () => {
    const code = `const App = () => <div>{props.visible ? 'show' : 'hide'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => props.visible ? 0 : 1, [() => 'show', () => 'hide'])
      });"
    `)
  })

  it('三元条件为函数调用', async () => {
    const code = `const App = () => <div>{isActive() ? 'active' : 'inactive'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => isActive() ? 0 : 1, [() => 'active', () => 'inactive'])
      });"
    `)
  })

  it('三元表达式与文本混合', async () => {
    const code = `const App = () => <div>Status: {active ? 'on' : 'off'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["Status: ", /* @__PURE__ */branch(() => unref(active) ? 0 : 1, [() => 'on', () => 'off'])]
      });"
    `)
  })

  it('多个三元表达式并列', async () => {
    const code = `const App = () => <div>{a ? 'A' : 'a'} - {b ? 'B' : 'b'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: [/* @__PURE__ */branch(() => unref(a) ? 0 : 1, [() => 'A', () => 'a']), " - ", /* @__PURE__ */branch(() => unref(b) ? 0 : 1, [() => 'B', () => 'b'])]
      });"
    `)
  })

  it('嵌套 MemberExpression 在条件中', async () => {
    const code = `const App = () => <div>{props.data.active ? 'on' : 'off'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => props.data.active ? 0 : 1, [() => 'on', () => 'off'])
      });"
    `)
  })

  it('逻辑与表达式返回 JSX 元素', async () => {
    const code = `const App = () => <div>{show && <span>visible</span>}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => show && /* @__PURE__ */createView("span", {
          children: "visible"
        }))
      });"
    `)
  })

  it('逻辑或表达式返回 JSX 元素', async () => {
    const code = `const App = () => <div>{fallback || <span>default</span>}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => fallback || /* @__PURE__ */createView("span", {
          children: "default"
        }))
      });"
    `)
  })

  it('空值合并表达式返回 JSX 元素', async () => {
    const code = `const App = () => <div>{value ?? <span>default</span>}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => value ?? /* @__PURE__ */createView("span", {
          children: "default"
        }))
      });"
    `)
  })

  it('嵌套 MemberExpression 在逻辑表达式中', async () => {
    const code = `const App = () => <div>{props.data.value || 'default'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => props.data.value || 'default')
      });"
    `)
  })
})

describe('模板字面量表达式', () => {
  it('动态模板字面量作为子元素应包装为 expr', async () => {
    const code = `const App = () => <div>{\`hello \${name}\`}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => \`hello \${name}\`)
      });"
    `)
  })

  it('静态模板字面量作为子元素应转为 StringLiteral', async () => {
    const code = 'const App = () => <div>{`hello world`}</div>'
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: "hello world"
      });"
    `)
  })

  it('条件分支中的动态模板字面量应包装为 expr', async () => {
    const code = 'const App = () => <div>{t.value ? `${show.value}动态` : "静态"}</div>'
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => t.value ? 0 : 1, [() => /* @__PURE__ */expr(() => \`\${show.value}动态\`), () => "静态"])
      });"
    `)
  })

  it('条件两个分支均为动态模板字面量', async () => {
    const code = 'const App = () => <div>{flag ? `${a.value}A` : `${b.value}B`}</div>'
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(flag) ? 0 : 1, [() => /* @__PURE__ */expr(() => \`\${a.value}A\`), () => /* @__PURE__ */expr(() => \`\${b.value}B\`)])
      });"
    `)
  })

  it('逻辑表达式中包含动态模板字面量', async () => {
    const code = 'const App = () => <div>{flag && `${count.value} items`}</div>'
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => flag && \`\${count.value} items\`)
      });"
    `)
  })
})
