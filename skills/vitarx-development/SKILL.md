---
name: "vitarx-development"
description: "Guide for building apps with Vitarx (signal-driven JSX framework) and @vitarx/plugin-vite. Invoke when creating components, writing JSX, using directives (v-if/v-model/v-show), compile components (Switch/Match/IfBlock), or configuring the Vite plugin."
---

# Vitarx Development Guide

Vitarx is a **signal-driven, high-performance JSX frontend framework**. It uses fine-grained dependency tracking instead of virtual DOM diff — when reactive data changes, only the affected DOM nodes update. This guide covers everything needed to build apps with Vitarx + `@vitarx/plugin-vite`.

## 1. Project Setup

### Create a New Project

```bash
pnpm create vitarx
```

### Manual Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vitarx from '@vitarx/plugin-vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vitarx()],  // or vitarx({ transformClassNameToClass: true })
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  }
})
```

### Plugin Options

| Option                      | Type      | Default | Description                                                 |
|-----------------------------|-----------|---------|-------------------------------------------------------------|
| `transformClassNameToClass` | `boolean` | `false` | Convert `className` to `class` on native HTML elements only |

### Entry File (main.tsx)

```typescript
import { createApp } from 'vitarx'
import App from './App'

const app = createApp(App)
// app.use(router)  // if using vitarx-router
app.mount('#root')
```

## 2. Component Basics

Vitarx uses **function components** with lifecycle hooks. Components must be **named with uppercase first letter** and **exported** for HMR to work.

```tsx
import { ref, onMounted, onDispose } from 'vitarx'

export default function Counter() {
  const count = ref(0)

  onMounted(() => console.log('mounted'))
  onDispose(() => console.log('unmounted'))

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => count.value++}>+1</button>
    </div>
  )
}
```

### Lifecycle Hooks

| Hook                  | Timing                   |
|-----------------------|--------------------------|
| `onInit(() => {})`    | Component initialization |
| `onMounted(() => {})` | DOM mounted              |
| `onDispose(() => {})` | Component destroyed      |

### Reactive APIs

```tsx
import { ref, reactive, computed, watch, watchEffect } from 'vitarx'

const count = ref(0)                    // Ref<T>
const state = reactive({ items: [] })  // Reactive object
const doubled = computed(() => count.value * 2)

watch(count, (newVal, oldVal) => {})   // Watch specific ref
watchEffect(() => { console.log(count.value) })  // Auto-track deps
```

## 3. JSX Compilation Rules (CRITICAL)

`@vitarx/plugin-vite` compiles JSX to `createView()` calls. Understanding the **ref unwrapping rules** is essential.

### 3.1 Ref Unwrapping in Props (`x={value}`)

The compiler uses **static analysis** to determine how to unwrap identifiers:

| Expression      | Condition                | Compiled Output                                |
|-----------------|--------------------------|------------------------------------------------|
| `x={count}`     | Known `ref` variable     | `get x() { return count.value }`               |
| `x={count}`     | Known non-ref (function) | `"x": count` (static assignment)               |
| `x={count}`     | Unknown identifier       | `get x() { return unref(count) }`              |
| `x={obj.key}`   | Member expression        | `get x() { return unref(obj.key) }`            |
| `x={fn()}`      | Call expression          | `get x() { return unref(fn()) }`               |
| `x={a + b}`     | Complex expression       | `get x() { return a + b }` (NOT unwrapped)     |
| `x={a ? b : c}` | Ternary                  | `get x() { return a ? b : c }` (NOT unwrapped) |

**Key rule**: For complex expressions (ternary, binary, logical, etc.), the compiler does **NOT** auto-unwrap refs. You must write `.value` explicitly:

```tsx
const count = ref(0)
const show = ref(false)

// ✅ Correct — simple identifier, auto-unwrapped
<div class={count} />
// → get class() { return count.value }

// ✅ Correct — complex expression, manual .value
<div class={count.value + 1} />
// → get class() { return count.value + 1 }

// ❌ Wrong — count is a Ref object, comparison always false
<div v-if={count === 0} />
// → branch(() => count === 0 ? ...) — count is Ref, not number!

// ✅ Correct
<div v-if={count.value === 0} />
// → branch(() => count.value === 0 ? ...)
```

### 3.2 Children Expressions

| Expression                     | Compiled As                         |
|--------------------------------|-------------------------------------|
| `{value}` (identifier)         | Passed as-is, runtime handles ref   |
| `{props.value}` (member)       | `accessor(props, 'value')`          |
| `{show ? 'a' : 'b'}` (ternary) | `branch(() => show ? 0 : 1, [...])` |
| `{a + b}` (binary)             | `expr(() => a + b)`                 |
| `{a && b}` (logical)           | `expr(() => a && b)`                |
| `{render()}` (call)            | `expr(() => render())`              |

### 3.3 Special Props (NOT Unwrapped)

These props bypass ref unwrapping:
- `children={refVar}` — runtime handles ref children
- `ref={refVar}` — ref binding needs the ref object itself

## 4. Directives

### v-if / v-else-if / v-else

```tsx
<>
  <div v-if={show}>Visible</div>
  <span v-else-if={other}>Alternative</span>
  <p v-else>Default</p>
</>
```

Compiles to `branch()` with conditions. **Remember**: `v-if={show}` auto-unwraps the identifier (known ref → `.value`, unknown → `unref()`), but `v-if={count === 0}` does NOT unwrap — write `.value` manually.

### v-model

```tsx
const name = ref('')
<Input v-model={name} />
```

Compiles to:
```javascript
createView(Input, {
  get modelValue() { return name.value },
  'onUpdate:modelValue': v => { name.value = v }
})
```

**Requirements**: v-model value must be an identifier that is a known `ref`, or a member expression like `obj.key` where the property is a ref.

### v-show

```tsx
<div v-show={visible}>Content</div>
```

Compiles to `withDirectives()` with `show` directive.

### v-bind (Spread)

```tsx
<div {...props} />
// or
<div v-bind={props} />
```

## 5. Compile-Time Components

### Switch / Match

Like JavaScript `switch`, compiles to `branch()`:

```tsx
<Switch fallback={<div>Default</div>}>
  <Match when={status === 'loading'}>Loading...</Match>
  <Match when={status === 'error'}>Error!</Match>
  <Match when={status === 'success'}>Success!</Match>
</Switch>
```

**Rules**:
- `Match` must be inside `Switch`
- `Match` must have a `when` prop
- `Switch` must have at least one `Match` child
- `when` expressions are NOT auto-unwrapped — write `.value` for refs in complex expressions

### IfBlock

Wraps v-if chains for correct typing:

```tsx
<IfBlock>
  <div v-if={a}>A</div>
  <span v-else-if={b}>B</span>
  <p v-else>C</p>
</IfBlock>
```

## 6. Built-in Components

```tsx
import { For, Suspense, Lazy, Freeze, Transition, Teleport } from 'vitarx'

// List rendering (responsive)
<For each={items} key={item => item.id}>
  {item => <div>{item.name}</div>}
</For>

// Async loading
<Suspense fallback={<Loading />}>
  <Lazy loader={() => import('./HeavyComponent')} />
</Suspense>

// Freeze (ignore signal changes)
<Freeze><StaticContent /></Freeze>

// Transition animation
<Transition name="fade">
  <div v-show={visible}>Content</div>
</Transition>

// Teleport
<Teleport to="body"><Modal /></Teleport>
```

## 7. Dependency Injection

```tsx
import { provide, inject } from 'vitarx'

function Parent() {
  provide('theme', 'dark')
  return <Child />
}

function Child() {
  const theme = inject('theme', 'light')
  return <div class={`theme-${theme}`}>Content</div>
}
```

## 8. Routing (vitarx-router)

```tsx
import { createRouter, defineRoutes, RouterView, RouterLink, lazy } from 'vitarx-router'

const routes = defineRoutes(
  { path: '/', name: 'home', component: lazy(() => import('@/pages/Home')) },
  { path: '/about', name: 'about', component: lazy(() => import('@/pages/About')) }
)

const router = createRouter({ routes })

// main.tsx
const app = createApp(App)
app.use(router)
app.mount('#root')

// App.tsx
export default function App() {
  return <RouterView />
}

// Navigation
<RouterLink to="home">Home</RouterLink>
```

## 9. HMR (Hot Module Replacement)

HMR is automatically injected for exported components in dev mode. No configuration needed.

**HMR identification rules** — a function gets HMR if:
1. Name starts with uppercase (component naming convention)
2. Is exported (`export`)
3. Contains JSX or returns compile-time components

**HMR code separation**: Changes are split into UI code (`createView`, `branch`, `expr`, etc.) and logic code. Only UI changes → rebuild view tree only. Logic changes → full remount.

## 10. Common Patterns

### Event Handling

```tsx
const count = ref(0)

// Inline — write .value manually
<button onClick={() => count.value++}>+1</button>

// Function reference — auto-detected as non-ref, no unref overhead
function handleClick() { count.value++ }
<button onClick={handleClick}>Click</button>

// Arrow function variable — auto-detected as non-ref
const handler = () => count.value++
<button onClick={handler}>Click</button>
```

### Conditional Rendering

```tsx
const show = ref(false)

// Simple identifier — auto-unwrapped
<div v-if={show}>Content</div>

// Complex condition — manual .value
<div v-if={count.value > 10}>Many</div>

// Ternary in children — manual .value
<div>{show.value ? 'Yes' : 'No'}</div>
```

### List Rendering

```tsx
const items = ref([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])

// ✅ Recommended: For component (responsive)
<For each={items} key={item => item.id}>
  {item => <div>{item.name}</div>}
</For>

// ⚠️ .map() works but only renders once (not responsive)
{items.value.map(item => <div>{item.name}</div>)}
```

### className vs class

```tsx
// Without transformClassNameToClass: use "class"
<div class="container">Content</div>

// With transformClassNameToClass: "className" auto-converts to "class"
<div className="container">Content</div>

// ❌ Cannot use both — throws E016 error
<div class="a" className="b">Error</div>
```

## 11. Error Codes

| Code | Description                                           |
|------|-------------------------------------------------------|
| E001 | Invalid JSX attribute value                           |
| E002 | Invalid v-model value                                 |
| E003 | v-else without preceding v-if                         |
| E004 | v-else-if without preceding v-if                      |
| E005 | Invalid v-if value                                    |
| E006 | Switch children must be Match components              |
| E007 | Match component missing `when` prop                   |
| E008 | IfBlock children must contain v-if directive          |
| E009 | v-model conflicts with modelValue                     |
| E010 | v-model value must be identifier or member expression |
| E011 | v-model identifier must be a ref                      |
| E012 | Match must be inside Switch                           |
| E013 | Match must contain children                           |
| E014 | IfBlock must contain children                         |
| E015 | Switch must contain at least one Match child          |
| E016 | class and className cannot coexist                    |

## 12. Best Practices

1. **Always use `.value` in complex expressions** — the compiler only auto-unwraps simple identifiers and member/call expressions
2. **Use `For` component for responsive lists** — `.map()` only renders once
3. **Name components with uppercase** — required for HMR
4. **Export components** — HMR only works on exported functions
5. **Use `class` not `className`** — unless `transformClassNameToClass` is enabled
6. **Prefer `ref` over `reactive` for primitives** — clearer mental model
7. **Use `watchEffect` for auto-dependency tracking** — avoids manual dependency lists
8. **Functions as props are optimized** — the compiler detects function declarations/arrow function variables and skips `unref()` wrapping
9. **Use `Switch/Match` for multi-branch conditions** — more efficient than chained v-if
10. **Keep components small and focused** — Vitarx's fine-grained updates mean small components don't have the overhead they do in React
