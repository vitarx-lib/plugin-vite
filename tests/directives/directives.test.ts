import { describe, expect, it } from 'vitest'
import { compile } from '../utils'

describe('指令转换', () => {
  it('v-show 指令', async () => {
    const code = `const App = () => <div v-show={visible}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, withDirectives, unref } from "vitarx";
      const App = () => /* @__PURE__ */withDirectives(createView("div"), [["show", {
        get value() {
          return unref(visible);
        }
      }]]);"
    `)
  })

  it('多个指令', async () => {
    const code = `const App = () => <div v-show={visible} v-disabled={disabled}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, withDirectives, unref } from "vitarx";
      const App = () => /* @__PURE__ */withDirectives(createView("div"), [["show", {
        get value() {
          return unref(visible);
        }
      }], ["disabled", {
        get value() {
          return unref(disabled);
        }
      }]]);"
    `)
  })
  it('带参数指令', async () => {
    const code = `const App = () => <div v-test:t={visible}></div>`
    const result = await compile(code)
    expect(result).toMatchInlineSnapshot(`
      "import { createView, withDirectives, unref } from "vitarx";
      const App = () => /* @__PURE__ */withDirectives(createView("div"), [["test", {
        get value() {
          return unref(visible);
        },
        arg: "t"
      }]]);"
    `)
  })
})
