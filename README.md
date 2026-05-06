# @vitarx/plugin-vite

Vitarx 的 Vite 编译插件，提供 JSX 到 `createView` 的编译转换、指令支持和 HMR 热更新功能。

## 特性

- 🚀 **JSX 编译** - 将 JSX 语法编译为高效的 `createView` 调用
- 📦 **编译宏指令** - 支持 `v-if`、`v-else-if`、`v-else`、`v-model`、`v-show` 等指令
- 🧩 **编译宏组件** - 内置 `Switch`、`Match`、`IfBlock` 纯编译组件
- 🔥 **HMR 支持** - 开发模式下自动注入热更新代码，支持组件状态保留
- 📝 **TypeScript** - 完整的 TypeScript 类型支持

## 安装

```bash
npm install @vitarx/plugin-vite
# 或
pnpm add @vitarx/plugin-vite
# 或
yarn add @vitarx/plugin-vite
```

## 使用方法

### 配置 Vite

在 `vite.config.ts` 中配置插件：

```typescript
import { defineConfig } from 'vite'
import vitarx from '@vitarx/plugin-vite'

export default defineConfig({
  plugins: [vitarx()]
})
```

### JSX 编译

插件会自动将 JSX 语法编译为 `createView` 调用：

```jsx
// 编译前
const App = () => <div className="container">Hello World</div>

// 编译后
import { createView } from 'vitarx'
const App = () => /* @__PURE__ */createView('div', {
  className: 'container',
  children: 'Hello World'
})
```

## 编译宏指令

### v-if / v-else-if / v-else

条件渲染指令，编译为高效的 `branch` 调用：

```jsx
<>
  <div v-if={show}>显示内容</div>
  <span v-else-if={other}>其他内容</span>
  <p v-else>默认内容</p>
</>
```

编译后：

```javascript
branch(
  () => unref(show) ? 0 : unref(other) ? 1 : 2,
  [
    () => createView('div', { children: '显示内容' }),
    () => createView('span', { children: '其他内容' }),
    () => createView('p', { children: '默认内容' })
  ]
)
```

### v-model

双向绑定指令，自动生成 `modelValue` 和 `onUpdate:modelValue`：

```jsx
<Input v-model={value} />
```

编译后：

```javascript
createView(Input, {
  get modelValue() { return unref(value) },
  'onUpdate:modelValue': v => { value.value = v }
})
```

### v-show

显示/隐藏指令：

```jsx
<div v-show={visible}>内容</div>
```

编译后：

```javascript
withDirectives(
  createView('div', { children: '内容' }),
  [['show', { get value() { return unref(visible) } }]]
)
```

## 编译宏组件

### Switch / Match

条件分支组件，类似于 JavaScript 的 switch 语句：

```jsx
<Switch fallback={<div>默认</div>}>
  <Match when={status === 'loading'}>加载中...</Match>
  <Match when={status === 'error'}>出错了</Match>
  <Match when={status === 'success'}>加载成功</Match>
</Switch>
```

编译后：

```javascript
branch(
  () => status === 'loading' ? 0 : status === 'error' ? 1 : status === 'success' ? 2 : 3,
  [
    () => '加载中...',
    () => '出错了',
    () => '加载成功',
    () => createView('div', { children: '默认' })
  ]
)
```

### IfBlock

用于包裹 v-if 链，确保类型正确：

```jsx
<IfBlock>
  <div v-if={a}>A</div>
  <span v-else-if={b}>B</span>
  <p v-else>C</p>
</IfBlock>
```

## Props 处理

### 响应式 Props

插件会自动处理响应式属性：

```jsx
// ref 变量自动使用 .value
const count = ref(0);
<div count={count} />
// 编译为: get count() { return count.value }

// 普通变量自动使用 unref
<div className={className} />
// 编译为: get className() { return unref(className) }

// 成员表达式直接访问
<div value={props.value} />
// 编译为: get value() { return props.value }
```

### v-bind 批量绑定

```jsx
<div {...props} />
// 或
<div v-bind={props} />
```

## HMR 热更新

开发模式下，插件会自动为导出的组件注入 HMR 支持：

```jsx
// 编译前
export const App = () => {
  const count = ref(0)
  return <div>{count}</div>
}

// 编译后（HMR 模式）
import __$VITARX_HMR$__ from '@vitarx/plugin-vite/hmr-client'
import { createView as jsxDEV, getInstance } from 'vitarx'

export const App = () => {
  const __$VITARX_HMR_VIEW_NODE$__ = getInstance()
  __$VITARX_HMR$__.instance.register(__$VITARX_HMR_VIEW_NODE$__)
  __$VITARX_HMR_VIEW_NODE$__ && Promise.resolve().then(() => {
    __$VITARX_HMR_VIEW_NODE$__._$_VITARX_HMR_VIEW_STATE_$_ = {
      get count() { return count }
    }
  })
  const count = ref(0)
  return jsxDEV('div', { children: count }, { fileName: '...', lineNumber: 5, columnNumber: 10 })
}

__$VITARX_HMR$__.instance.bindId(App, 'abc123')
import.meta.hot.accept(mod => {
  __$VITARX_HMR$__.instance.update(mod)
})
```

### HMR 组件识别规则

只有满足以下条件的函数才会被注入 HMR 支持：

1. **函数名大写字母开头** - 符合组件命名规范
2. **被导出** - 使用 `export` 导出
3. **包含 JSX** - 函数体内包含 JSX 语法或返回编译宏组件

### HMR 代码分离

HMR 在检测到组件更新时，会将组件代码分离为 **UI 代码** 和 **逻辑代码** 两部分：

- **UI 代码**：`createView`、`branch`、`expr`、`accessor`、`dynamic`、`withDirectives` 等调用
- **逻辑代码**：其余所有代码

仅逻辑代码变化时，组件完全重新挂载；仅 UI 代码变化时，仅重建视图树。

### 开发模式位置信息

开发模式下，`createView` 调用会注入位置信息参数（用于调试），`branch`、`expr`、`accessor` 不注入：

```javascript
// dev 模式
createView("div", { children: "hello" }, { fileName: "App.tsx", lineNumber: 5, columnNumber: 10 })
expr(() => a && b)  // 无位置信息
branch(() => unref(show) ? 0 : 1)  // 无位置信息
accessor(props, "value")  // 无位置信息

// 生产模式
createView("div", { children: "hello" })  // 无位置信息
```

## 子元素处理

### 响应式子元素

```jsx
// 标识符保持原样
<div>{value}</div>

// 成员表达式使用 accessor
<div>{props.value}</div>
// 编译为: accessor(props, 'value')

// 条件表达式使用 branch
<div>{show ? 'yes' : 'no'}</div>
// 编译为: branch(() => unref(show) ? 0 : 1, [...])

// 逻辑表达式使用 expr
<div>{a && b}</div>
// 编译为: expr(() => a && b)

// 二元表达式使用 expr
<div>{count + 1}</div>
// 编译为: expr(() => count + 1)

// 函数调用使用 expr
<div>{render()}</div>
// 编译为: expr(() => render())
```

### expr 与数组返回值

`expr` 底层由 `DynamicView` 渲染。当 `expr` 中的表达式返回数组时（如 `arr.map()`），运行时会自动检测并原样返回数组（仅渲染一次，不跟踪响应式）。推荐使用 `For` 组件实现动态数组的响应式渲染。

```jsx
// arr.map() 返回数组，expr 运行时原样返回（仅渲染一次）
<div>{items.map(item => <span>{item}</span>)}</div>
// 编译为: expr(() => items.map(item => createView("span", { children: item })))

// 推荐：使用 For 组件实现响应式数组渲染
<div>
  <For each={items} key="id">{item => <span>{item}</span>}</For>
</div>
```

### 运行时 API 说明

| API              | 用途      | 编译器注入     | HMR 识别为 UI 代码 |
|------------------|---------|-----------|---------------|
| `createView`     | 创建视图节点  | ✅         | ✅             |
| `branch`         | 条件分支渲染  | ✅         | ✅             |
| `expr`           | 动态表达式包装 | ✅         | ✅             |
| `accessor`       | 属性访问追踪  | ✅         | ✅             |
| `dynamic`        | 动态值包装   | ❌（用户手动使用） | ✅             |
| `withDirectives` | 指令绑定    | ✅         | ✅             |

> **注意：** `expr` 是编译器插桩注入的辅助函数，用于包装逻辑/二元/调用表达式；`dynamic` 是运行时独立 API，供用户手动使用。两者在 HMR 代码分离时均被视为 UI 描述代码。

## API 参考

### 插件选项

```typescript
interface VitePluginVitarxOptions {
  /**
   * 是否将 className 属性转换为 class 属性
   * 仅对原生 HTML 元素生效，组件不生效
   * @default false
   */
  transformClassNameToClass?: boolean
}
```

### className 转 class

启用 `transformClassNameToClass` 选项后，原生 HTML 元素的 `className` 属性会自动转换为 `class`：

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vitarx from '@vitarx/plugin-vite'

export default defineConfig({
  plugins: [vitarx({ transformClassNameToClass: true })]
})
```

```jsx
// 编译前
<div className="container">Hello</div>

// 编译后
createView('div', { class: 'container', children: 'Hello' })
```

**注意事项：**
- 仅对原生 HTML 元素（小写字母开头）生效，组件不转换
- `class` 和 `className` 不能同时存在，否则会抛出 `E016` 错误
- `class` 属性优先级更高

## 目录结构

```
src/
├── constants/      # 常量定义
├── hmr-client/     # HMR 客户端运行时
├── passes/         # 编译转换处理
│   ├── components/ # 编译宏组件
│   ├── directives/ # 指令处理
│   ├── hmr/        # HMR 注入
│   ├── imports/    # 导入处理
│   ├── jsx/        # JSX 转换
│   └── props/  # 属性处理
├── utils/          # 公共工具函数
├── context.ts      # 转换上下文
├── error.ts        # 错误处理
├── transform.ts    # 主转换入口
└── index.ts        # 插件入口
```

## 错误码

| 错误码  | 描述                          |
|------|-----------------------------|
| E001 | 无效的 JSX 属性值                 |
| E002 | 无效的 v-model 值               |
| E003 | v-else 没有前置的 v-if           |
| E004 | v-else-if 没有前置的 v-if        |
| E005 | 无效的 v-if 值                  |
| E006 | Switch 子元素必须是 Match 组件      |
| E007 | Match 组件缺少 when 属性          |
| E008 | IfBlock 子元素必须包含 v-if 指令     |
| E009 | v-model 与 modelValue 冲突     |
| E010 | v-model 值必须是标识符或成员表达式       |
| E011 | v-model Identifier 必须是 ref  |
| E012 | Match 组件必须位于 Switch 组件内部    |
| E013 | Match 组件必须包含子元素             |
| E014 | IfBlock 组件必须包含子元素           |
| E015 | Switch 组件必须包含至少一个 Match 子元素 |
| E016 | class 和 className 不能同时存在    |

## License

MIT
