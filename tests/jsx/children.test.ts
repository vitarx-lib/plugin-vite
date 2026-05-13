import { describe, expect, it } from 'vitest'
import { compile } from '../test-utils.js'

describe('Children 处理', () => {
  it('Identifier 子元素保持原样（不使用 unref）', async () => {
    const code = `const App = () => <div>{value}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: value
      });"
    `)
  })

  it('MemberExpression 子元素使用 accessor', async () => {
    const code = `const App = () => <div>{props.value}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, accessor } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: accessor(props, "value")
      });"
    `)
  })

  it('ConditionalExpression 子元素生成 branch（条件使用 unref）', async () => {
    const code = `const App = () => <div>{cond ? 'yes' : 'no'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(cond) ? 0 : 1, [() => 'yes', () => 'no'])
      });"
    `)
  })

  it('ConditionalExpression with Identifier condition', async () => {
    const code = `const App = () => <div>{show ? 'yes' : 'no'}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(show) ? 0 : 1, [() => 'yes', () => 'no'])
      });"
    `)
  })

  it('LogicalExpression 子元素生成 expr', async () => {
    const code = `const App = () => <div>{a && b}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => a && b)
      });"
    `)
  })

  it('BinaryExpression 子元素生成 expr', async () => {
    const code = `const App = () => <div>{count.value + 1}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => count.value + 1)
      });"
    `)
  })

  it('CallExpression 子元素生成 expr', async () => {
    const code = `const App = () => <div>{render()}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => render())
      });"
    `)
  })
})

describe('多子元素处理', () => {
  it('多个文本子元素', async () => {
    const code = `const App = () => <div>Hello {'World'}!</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["Hello ", 'World', "!"]
      });"
    `)
  })

  it('多个 Identifier 子元素', async () => {
    const code = `const App = () => <div>{a}{b}{c}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: [a, b, c]
      });"
    `)
  })

  it('混合类型子元素（文本 + Identifier + 嵌套元素）', async () => {
    const code = `const App = () => <div>Hello {name}!<span>child</span></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["Hello ", name, "!", /* @__PURE__ */createView("span", {
          children: "child"
        })]
      });"
    `)
  })

  it('多个嵌套元素', async () => {
    const code = `const App = () => <div><span>A</span><span>B</span><span>C</span></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: [/* @__PURE__ */createView("span", {
          children: "A"
        }), /* @__PURE__ */createView("span", {
          children: "B"
        }), /* @__PURE__ */createView("span", {
          children: "C"
        })]
      });"
    `)
  })

  it('混合 MemberExpression 和 Identifier', async () => {
    const code = `const App = () => <div>{props.a}{b}{props.c}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, accessor } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: [accessor(props, "a"), b, accessor(props, "c")]
      });"
    `)
  })
})

describe('边界情况', () => {
  it('嵌套 MemberExpression 降级为 expr', async () => {
    const code = `const App = () => <div>{props.data.nested.value}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => props.data.nested.value)
      });"
    `)
  })

  it('Ref 的 .value.length 降级为 expr', async () => {
    const code = `const App = () => <div>{data.value.length}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => data.value.length)
      });"
    `)
  })

  it('Ref 的 .value 属性使用 accessor', async () => {
    const code = `const App = () => <div>{data.value}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, accessor } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: accessor(data, "value")
      });"
    `)
  })

  it('计算属性访问使用 accessor', async () => {
    const code = `const App = () => <div>{obj[key]}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, accessor } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: accessor(obj, "key")
      });"
    `)
  })

  it('数组 map 方法调用', async () => {
    const code = `const App = () => <div>{items.map(item => <span>{item}</span>)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => items.map(item => /* @__PURE__ */createView("span", {
          children: item
        })))
      });"
    `)
  })

  it('三元表达式嵌套 JSX 元素', async () => {
    const code = `const App = () => <div>{show ? <span>yes</span> : <span>no</span>}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => unref(show) ? 0 : 1, [() => /* @__PURE__ */createView("span", {
          children: "yes"
        }), () => /* @__PURE__ */createView("span", {
          children: "no"
        })])
      });"
    `)
  })

  it('逻辑或表达式', async () => {
    const code = `const App = () => <div>{a || b}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => a || b)
      });"
    `)
  })

  it('复杂混合表达式', async () => {
    const code = `const App = () => <div>{a && b ? <span>x</span> : c || d}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, branch, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */branch(() => (a && b) ? 0 : 1, [() => /* @__PURE__ */createView("span", {
          children: "x"
        }), () => /* @__PURE__ */expr(() => c || d)])
      });"
    `)
  })

  it('空表达式容器被忽略', async () => {
    const code = `const App = () => <div>text{/* comment */}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: "text"
      });"
    `)
  })

  it('纯空白文本被忽略', async () => {
    const code = `const App = () => <div>   </div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div");"
    `)
  })

  it('数字字面量子元素', async () => {
    const code = `const App = () => <div>{42}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: 42
      });"
    `)
  })

  it('布尔字面量子元素', async () => {
    const code = `const App = () => <div>{true}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: true
      });"
    `)
  })

  it('Null字面量子元素', async () => {
    const code = `const App = () => <div>{null}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: null
      });"
    `)
  })

  it('对象字面量子元素', async () => {
    const code = `const App = () => <div>{{ a: 1 }}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: {
          a: 1
        }
      });"
    `)
  })

  it('数组字面量子元素', async () => {
    const code = `const App = () => <div>{[1, 2, 3]}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: [1, 2, 3]
      });"
    `)
  })

  it('模板字面量子元素', async () => {
    const code = 'const App = () => <div>{`hello ${name}`}</div>'
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: \`hello \${name}\`
      });"
    `)
  })

  it('函数调用带参数', async () => {
    const code = `const App = () => <div>{render(a, b, c)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => render(a, b, c))
      });"
    `)
  })

  it('链式方法调用', async () => {
    const code = `const App = () => <div>{props.items.filter(x => x.active).map(x => x.name)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => props.items.filter(x => x.active).map(x => x.name))
      });"
    `)
  })
})

describe('数组方法调用', () => {
  it('map 方法返回 JSX', async () => {
    const code = `const App = () => <ul>{items.map(item => <li>{item}</li>)}</ul>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("ul", {
        children: /* @__PURE__ */expr(() => items.map(item => /* @__PURE__ */createView("li", {
          children: item
        })))
      });"
    `)
  })

  it('map 方法返回文本', async () => {
    const code = `const App = () => <div>{items.map(item => item.name)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => items.map(item => item.name))
      });"
    `)
  })

  it('filter + map 链式调用', async () => {
    const code = `const App = () => <div>{items.filter(x => x.active).map(x => <span>{x.name}</span>)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr, accessor } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => items.filter(x => x.active).map(x => /* @__PURE__ */createView("span", {
          children: accessor(x, "name")
        })))
      });"
    `)
  })

  it('flatMap 方法调用', async () => {
    const code = `const App = () => <div>{items.flatMap(item => <span>{item}</span>)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => items.flatMap(item => /* @__PURE__ */createView("span", {
          children: item
        })))
      });"
    `)
  })

  it('slice 方法调用', async () => {
    const code = `const App = () => <div>{items.slice(0, 5).map(x => <span>{x}</span>)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => items.slice(0, 5).map(x => /* @__PURE__ */createView("span", {
          children: x
        })))
      });"
    `)
  })

  it('find 方法调用', async () => {
    const code = `const App = () => <div>{items.find(x => x.id === 1)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => items.find(x => x.id === 1))
      });"
    `)
  })

  it('reduce 方法调用', async () => {
    const code = `const App = () => <div>{items.reduce((acc, cur) => acc + cur, 0)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => items.reduce((acc, cur) => acc + cur, 0))
      });"
    `)
  })

  it('map 带索引参数', async () => {
    const code = `const App = () => <div>{items.map((item, index) => <span key={index}>{item}</span>)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => items.map((item, index) => /* @__PURE__ */createView("span", {
          get "key"() {
            return unref(index);
          },
          children: item
        })))
      });"
    `)
  })

  it('成员表达式上的 map 调用', async () => {
    const code = `const App = () => <div>{props.items.map(item => <span>{item}</span>)}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, expr } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: /* @__PURE__ */expr(() => props.items.map(item => /* @__PURE__ */createView("span", {
          children: item
        })))
      });"
    `)
  })
})

describe('空字符串子元素', () => {
  it('空字符串字面量作为唯一子元素保留', async () => {
    const code = `const App = () => <div>{""}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ""
      });"
    `)
  })

  it('空字符串字面量（单引号）作为唯一子元素保留', async () => {
    const code = `const App = () => <div>{''}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ''
      });"
    `)
  })

  it('空字符串与文本混合', async () => {
    const code = `const App = () => <div>text{""}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["text", ""]
      });"
    `)
  })

  it('文本与空字符串混合', async () => {
    const code = `const App = () => <div>{""}text</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["", "text"]
      });"
    `)
  })

  it('多个空字符串子元素保留', async () => {
    const code = `const App = () => <div>{""}{""}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["", ""]
      });"
    `)
  })

  it('空字符串与元素混合', async () => {
    const code = `const App = () => <div>{""}<span>child</span></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["", /* @__PURE__ */createView("span", {
          children: "child"
        })]
      });"
    `)
  })

  it('空字符串与 Identifier 混合', async () => {
    const code = `const App = () => <div>{""}{name}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["", name]
      });"
    `)
  })

  it('空字符串与文本和元素混合', async () => {
    const code = `const App = () => <div>Hello{""}<span>world</span></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["Hello", "", /* @__PURE__ */createView("span", {
          children: "world"
        })]
      });"
    `)
  })

  it('空格字符串字面量作为子元素保留', async () => {
    const code = `const App = () => <div>{' '}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ' '
      });"
    `)
  })

  it('空格字符串与文本混合', async () => {
    const code = `const App = () => <div>Hello{' '}World</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["Hello", ' ', "World"]
      });"
    `)
  })

  it('多个空格字符串原样保留', async () => {
    const code = `const App = () => <div>{'   '}</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: '   '
      });"
    `)
  })

  it('多个空格字符串与文本混合原样保留', async () => {
    const code = `const App = () => <div>Hello{'   '}World</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["Hello", '   ', "World"]
      });"
    `)
  })
})

describe('JSXText 空白处理', () => {
  it('表达式之间的 JSXText 保留空白', async () => {
    const code = `const App = () => <p>{title} - {heading}</p>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("p", {
        children: [title, " - ", heading]
      });"
    `)
  })

  it('多行格式化的表达式间 JSXText', async () => {
    const code = `const App = () => (
      <p>
        {title} - {heading}
      </p>
    )`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("p", {
        children: [title, " - ", heading]
      });"
    `)
  })

  it('表达式前仅有空白', async () => {
    const code = `const App = () => <p>  {title}</p>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("p", {
        children: title
      });"
    `)
  })

  it('表达式后仅有空白', async () => {
    const code = `const App = () => <p>{title}  </p>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("p", {
        children: title
      });"
    `)
  })

  it('元素之间的空白 JSXText 被忽略', async () => {
    const code = `const App = () => (
      <div>
        <span>A</span>
        <span>B</span>
      </div>
    )`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: [/* @__PURE__ */createView("span", {
          children: "A"
        }), /* @__PURE__ */createView("span", {
          children: "B"
        })]
      });"
    `)
  })

  it('文本与元素之间仅有空白', async () => {
    const code = `const App = () => <div>Hello <span>World</span></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["Hello ", /* @__PURE__ */createView("span", {
          children: "World"
        })]
      });"
    `)
  })

  it('元素与文本之间仅有空白', async () => {
    const code = `const App = () => <div><span>Hello</span> World</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: [/* @__PURE__ */createView("span", {
          children: "Hello"
        }), " World"]
      });"
    `)
  })

  it('多行文本中换行折叠为空格', async () => {
    const code = `const App = () => <div>line1\nline2</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: "line1 line2"
      });"
    `)
  })
})

describe('换行符子元素', () => {
  it('JSXText 纯换行被忽略', async () => {
    const code = `const App = () => <div></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div");"
    `)
  })
  it('JSXText 多个换行被忽略', async () => {
    const code = `const App = () => <div>\n\n\n</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div");"
    `)
  })
  it('JSXText 换行与空格混合被忽略', async () => {
    const code = `const App = () => <div>  \n  \n  </div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div");"
    `)
  })
  it('JSXText 换行与文本混合保留文本', async () => {
    const code = `const App = () => <div>\nHello\n</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: " Hello "
      });"
    `)
  })
  it('JSXText 多行文本应该聚合为一行，换行以空格代替', async () => {
    const code = `const App = () => <div>
  line1
  line2
</div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: " line1 line2 "
      });"
    `)
  })
  it('JSXText 换行分隔文本与元素', async () => {
    const code = `const App = () => <div>Hello\n<span>World</span></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        children: ["Hello ", /* @__PURE__ */createView("span", {
          children: "World"
        })]
      });"
    `)
  })
})
