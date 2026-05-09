import { describe, expect, it } from 'vitest'
import { classNameTransformOptions, compile } from '../test-utils.js'

describe('Props getter 行为', () => {
  it('静态字符串属性', async () => {
    const code = `const App = () => <div className="test"></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "className": "test"
      });"
    `)
  })

  it('静态数字属性', async () => {
    const code = `const App = () => <div count={42}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "count": 42
      });"
    `)
  })

  it('静态布尔属性', async () => {
    const code = `const App = () => <div disabled={true}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "disabled": true
      });"
    `)
  })

  it('Identifier 属性生成 getter', async () => {
    const code = `const App = () => <div className={className}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        get "className"() {
          return unref(className);
        }
      });"
    `)
  })

  it('MemberExpression 属性生成 getter', async () => {
    const code = `const App = () => <div className={props.className}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, accessor } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "className": accessor(props, "className")
      });"
    `)
  })
  it('中划线属性名支持', async () => {
    const code = `const App = () => <div data-id={props.className}></div>`
    expect(await compile(code)).toMatchInlineSnapshot(`
      "import { createView, accessor } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "data-id": accessor(props, "className")
      });"
    `)
  })

  it('复杂表达式属性生成 getter', async () => {
    const code = `const App = () => <div className={a + b}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        get "className"() {
          return a + b;
        }
      });"
    `)
  })

  it('v-bind 属性', async () => {
    const code = `const App = () => <div v-bind={props}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "v-bind": props
      });"
    `)
  })

  it('spread 属性转换为 v-bind', async () => {
    const code = `const App = () => <div {...props}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "v-bind": props
      });"
    `)
  })
})

describe('ref 变量优化', () => {
  it('ref 定义的变量直接使用 .value', async () => {
    const code = `import { ref } from 'vitarx'; const count = ref(0); const App = () => <div count={count}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { ref, createView } from 'vitarx';
      const count = ref(0);
      const App = () => /* @__PURE__ */createView("div", {
        get "count"() {
          return count.value;
        }
      });"
    `)
  })

  it('toRef 定义的变量直接使用 .value', async () => {
    const code = `import { toRef } from 'vitarx'; const count = toRef(props, 'count'); const App = () => <div count={count}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { toRef, createView } from 'vitarx';
      const count = toRef(props, 'count');
      const App = () => /* @__PURE__ */createView("div", {
        get "count"() {
          return count.value;
        }
      });"
    `)
  })

  it('shallowRef 定义的变量直接使用 .value', async () => {
    const code = `import { shallowRef } from 'vitarx'; const count = shallowRef(0); const App = () => <div count={count}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { shallowRef, createView } from 'vitarx';
      const count = shallowRef(0);
      const App = () => /* @__PURE__ */createView("div", {
        get "count"() {
          return count.value;
        }
      });"
    `)
  })

  it('computed 定义的变量直接使用 .value', async () => {
    const code = `import { computed } from 'vitarx'; const double = computed(() => count.value * 2); const App = () => <div double={double}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { computed, createView } from 'vitarx';
      const double = computed(() => count.value * 2);
      const App = () => /* @__PURE__ */createView("div", {
        get "double"() {
          return double.value;
        }
      });"
    `)
  })

  it('ref 使用别名时正确识别', async () => {
    const code = `import { ref as r } from 'vitarx'; const count = r(0); const App = () => <div count={count}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { ref as r, createView } from 'vitarx';
      const count = r(0);
      const App = () => /* @__PURE__ */createView("div", {
        get "count"() {
          return count.value;
        }
      });"
    `)
  })

  it('从 @vitarx/responsive 导入的 ref 正确识别', async () => {
    const code = `import { ref } from '@vitarx/responsive'; const count = ref(0); const App = () => <div count={count}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      import { ref } from '@vitarx/responsive';
      const count = ref(0);
      const App = () => /* @__PURE__ */createView("div", {
        get "count"() {
          return count.value;
        }
      });"
    `)
  })

  it('非 ref 定义的变量仍使用 unref', async () => {
    const code = `const count = someOtherApi(0); const App = () => <div count={count}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, unref } from "vitarx";
      const count = someOtherApi(0);
      const App = () => /* @__PURE__ */createView("div", {
        get "count"() {
          return unref(count);
        }
      });"
    `)
  })

  it('toRefs 解构定义的 ref 变量', async () => {
    const code = `import { toRefs } from 'vitarx'; const { a, b } = toRefs(props); const App = () => <div a={a} b={b}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { toRefs, createView } from 'vitarx';
      const {
        a,
        b
      } = toRefs(props);
      const App = () => /* @__PURE__ */createView("div", {
        get "a"() {
          return a.value;
        },
        get "b"() {
          return b.value;
        }
      });"
    `)
  })

  it('toRefs 使用别名时正确识别', async () => {
    const code = `import { toRefs as t } from 'vitarx'; const { a } = t(props); const App = () => <div a={a}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { toRefs as t, createView } from 'vitarx';
      const {
        a
      } = t(props);
      const App = () => /* @__PURE__ */createView("div", {
        get "a"() {
          return a.value;
        }
      });"
    `)
  })

  it('普通对象解构无法静态识别 ref', async () => {
    const code = `import { ref } from 'vitarx'; const { a, b } = { a: ref(1), b: ref(2) }; const App = () => <div a={a} b={b}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { ref, createView, unref } from 'vitarx';
      const {
        a,
        b
      } = {
        a: ref(1),
        b: ref(2)
      };
      const App = () => /* @__PURE__ */createView("div", {
        get "a"() {
          return unref(a);
        },
        get "b"() {
          return unref(b);
        }
      });"
    `)
  })
})

describe('className 转 class', () => {
  it('默认不转换 className', async () => {
    const code = `const App = () => <div className="test"></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "className": "test"
      });"
    `)
  })

  it('启用 transformClassNameToClass 时转换 className 为 class', async () => {
    const code = `const App = () => <div className="test"></div>`
    const result = await compile(code, classNameTransformOptions)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "class": "test"
      });"
    `)
  })

  it('启用 transformClassNameToClass 时动态 className 转换为 class getter', async () => {
    const code = `const App = () => <div className={dynamicClass}></div>`
    const result = await compile(code, classNameTransformOptions)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, unref } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        get "class"() {
          return unref(dynamicClass);
        }
      });"
    `)
  })

  it('启用 transformClassNameToClass 时组件不转换 className', async () => {
    const code = `const App = () => <MyComponent className="test"></MyComponent>`
    const result = await compile(code, classNameTransformOptions)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView(MyComponent, {
        "className": "test"
      });"
    `)
  })

  it('启用 transformClassNameToClass 时 class 和 className 同时存在抛出错误', async () => {
    const code = `const App = () => <div class="a" className="b"></div>`
    await expect(async () => {
      await compile(code, classNameTransformOptions)
    }).rejects.toThrow('[E016]')
  })

  it('启用 transformClassNameToClass 时 className 在前 class 在后也抛出错误', async () => {
    const code = `const App = () => <div className="b" class="a"></div>`
    await expect(async () => {
      await compile(code, classNameTransformOptions)
    }).rejects.toThrow('[E016]')
  })

  it('启用 transformClassNameToClass 时单独使用 class 正常工作', async () => {
    const code = `const App = () => <div class="test"></div>`
    const result = await compile(code, classNameTransformOptions)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "class": "test"
      });"
    `)
  })

  it('未启用 transformClassNameToClass 时 class 和 className 可同时存在', async () => {
    const code = `const App = () => <div class="a" className="b"></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView } from "vitarx";
      const App = () => /* @__PURE__ */createView("div", {
        "class": "a",
        "className": "b"
      });"
    `)
  })
})
