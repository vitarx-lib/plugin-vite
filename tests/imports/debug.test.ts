import { describe, expect, test } from 'vitest'
import type { CompileOptions } from '../../src/transform.js'
import { compile } from '../utils/index.js'

const hmrOptions: CompileOptions = {
  hmr: true,
  dev: true,
  ssr: false,
  runtimeModule: 'vitarx',
  sourceMap: false
}

const normalOptions: CompileOptions = {
  hmr: false,
  dev: false,
  ssr: false,
  runtimeModule: 'vitarx',
  sourceMap: false
}

describe('验证可能出现的导入语句注入BUG', () => {
  describe('import type 语句处理', () => {
    test('不会误将api导入追加到import type {} 语句中', async () => {
      const code = `import type { View } from 'vitarx'

export default function Home(): View {
  return <div>Home</div>
}
`
      const result = await compile(code, hmrOptions)
      // 验证 import type 语句没有被修改
      expect(result).toContain("import type { View } from 'vitarx'")

      // 验证 API 导入被注入到新的普通 import 语句中
      expect(result).toMatch(/import\s+\{[^}]*createView[^}]*}\s+from\s+["']vitarx["']/)

      // 验证 import type 语句中没有 createView
      expect(result).not.toMatch(/import\s+type\s+\{[^}]*createView[^}]*}/)
    })

    test('import type 包含多个类型时不会被修改', async () => {
      const code = `import type { View, Fragment } from 'vitarx'

export default function Home(): View {
  return <><div>Home</div></>
}
`
      const result = await compile(code, hmrOptions)
      // 验证 import type 语句保持原样
      expect(result).toContain("import type { View, Fragment } from 'vitarx'")

      // 验证运行时 API 被正确注入
      expect(result).toMatch(/import\s+\{[^}]*createView[^}]*}\s+from\s+["']vitarx["']/)
    })

    test('import typeof 语句不会被修改', async () => {
      const code = `import typeof { View } from 'vitarx'

export default function Home() {
  return <div>Home</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证 import typeof 语句保持原样
      expect(result).toContain("import typeof { View } from 'vitarx'")
    })
  })

  describe('混合导入场景', () => {
    test('同时存在 import type 和普通 import 时正确处理', async () => {
      const code = `import type { View } from 'vitarx'
import { ref } from 'vitarx'

export default function Home(): View {
  const count = ref(0)
  return <div>{count}</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证 import type 保持不变
      expect(result).toContain("import type { View } from 'vitarx'")

      // 验证普通 import 包含 ref 和新增的 API
      expect(result).toMatch(/import\s+\{[^}]*ref[^}]*}[^;]*from\s+["']vitarx["']/)
    })

    test('普通 import 和 import type 顺序不影响注入', async () => {
      const code = `import { ref } from 'vitarx'
import type { View } from 'vitarx'

export default function Home(): View {
  const count = ref(0)
  return <div>{count}</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证 API 被追加到第一个普通 import
      expect(result).toMatch(/import\s+\{[^}]*ref[^}]*createView[^}]*}\s+from\s+["']vitarx["']/)
    })
  })

  describe('命名空间导入', () => {
    test('命名空间导入时创建新的导入语句', async () => {
      const code = `import * as Vitarx from 'vitarx'

export default function Home() {
  return <div>Home</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证命名空间导入保持不变
      expect(result).toContain("import * as Vitarx from 'vitarx'")

      // 验证创建了新的普通导入
      expect(result).toMatch(/import\s+\{[^}]*createView[^}]*}\s+from\s+["']vitarx["']/)
    })
  })

  describe('默认导入', () => {
    test('默认导入时创建新的命名导入', async () => {
      const code = `import Vitarx from 'vitarx'

export default function Home() {
  return <div>Home</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证默认导入保持不变
      expect(result).toContain("import Vitarx from 'vitarx'")

      // 验证创建了新的命名导入
      expect(result).toMatch(/import\s+\{[^}]*createView[^}]*}\s+from\s+["']vitarx["']/)
    })
  })

  describe('无导入场景', () => {
    test('没有任何导入时创建新的导入语句', async () => {
      const code = `export default function Home() {
  return <div>Home</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证创建了新的导入语句
      expect(result).toMatch(/import\s+\{[^}]*createView[^}]*}\s+from\s+["']vitarx["']/)
    })
  })

  describe('多模块导入', () => {
    test('从其他模块导入时不影响 vitarx 导入', async () => {
      const code = `import { xxx } from 'test'
import type { View } from 'vitarx'

export default function Home(): View {
  return <div>Home</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证 react 导入保持不变
      expect(result).toContain("import { xxx } from 'test'")

      // 验证 vitarx import type 保持不变
      expect(result).toContain("import type { View } from 'vitarx'")

      // 验证 vitarx API 被正确注入
      expect(result).toMatch(/import\s+\{[^}]*createView[^}]*}\s+from\s+["']vitarx["']/)
    })

    test('多个模块混合导入时正确处理', async () => {
      const code = `import { xxx } from 'test'
import { ref } from 'vitarx'
import type { View } from 'vitarx'
import { computed } from 'test2'

export default function Home(): View {
  const count = ref(0)
  return <div>{count}</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证各模块导入正确
      expect(result).toContain("import { xxx } from 'test'")
      expect(result).toContain("import type { View } from 'vitarx'")
      expect(result).toContain("import { computed } from 'test2'")

      // 验证 vitarx API 被追加到正确的位置
      expect(result).toMatch(/import\s+\{[^}]*ref[^}]*createView[^}]*}\s+from\s+["']vitarx["']/)
    })
  })

  describe('别名导入', () => {
    test('导入时使用别名不会冲突', async () => {
      const code = `import { ref as reactiveRef } from 'vitarx'

export default function Home() {
  const count = reactiveRef(0)
  return <div>{count}</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证别名保持不变
      expect(result).toContain('ref as reactiveRef')

      // 验证 createView 被正确注入
      expect(result).toMatch(
        /import\s+\{[^}]*ref\s+as\s+reactiveRef[^}]*createView[^}]*}\s+from\s+["']vitarx["']/
      )
    })
  })

  describe('HMR 特定场景', () => {
    test('HMR 模式下正确注入 HMR 相关导入', async () => {
      const code = `export default function Home() {
  return <div>Home</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证 HMR 相关导入
      expect(result).toContain('getComponentView as __$VITARX_GET_COMPONENT_VIEW$__')
      expect(result).toContain('@vitarx/vite-plugin/hmr-client')
    })

    test('非 HMR 模式下不注入 HMR 相关导入', async () => {
      const code = `export default function Home() {
  return <div>Home</div>
}
`
      const result = await compile(code, normalOptions)

      // 验证没有 HMR 相关导入
      expect(result).not.toContain('__$VITARX_GET_COMPONENT_VIEW$__')
      expect(result).not.toContain('@vitarx/vite-plugin/hmr-client')
    })
  })

  describe('边缘情况', () => {
    test('空文件不会报错', async () => {
      const code = ``
      const result = await compile(code, hmrOptions)
      expect(result).toBeDefined()
    })

    test('只有注释的文件不会报错', async () => {
      const code = `// This is a comment
/* Multi-line comment */`
      const result = await compile(code, hmrOptions)
      expect(result).toBeDefined()
    })

    test('重复导入同一 API 不会重复注入', async () => {
      const code = `import { type createView } from 'vitarx'

export default function Home() {
  return <div>Home</div>
}
`
      const result = await compile(code, hmrOptions)
      // 验证 createView 只出现一次
      const matches = result.match(/import\s+\{[^}]*createView[^}]*}/g)
      expect(matches).toHaveLength(1)
    })

    test('导入语句中有换行和空格时正确处理', async () => {
      const code = `import {
  ref,
  computed
} from 'vitarx'

export default function Home() {
  const count = ref(0)
  return <div>{count}</div>
}
`
      const result = await compile(code, hmrOptions)

      // 验证导入被正确处理
      expect(result).toContain('ref')
      expect(result).toContain('computed')
      expect(result).toMatch(/createView/)
    })
  })
})
