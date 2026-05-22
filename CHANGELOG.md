# [1.0.0-beta.8](https://gitee.com/vitarx/plugin-vite/compare/v1.0.0-beta.7...v1.0.0-beta.8) (2026-05-22)


### Features

* **jsx:** 支持嵌套三元表达式及复杂条件分支处理 ([b6db31b](https://gitee.com/vitarx/plugin-vite/commits/b6db31b2be2d5888906d79ef9f0fb2a3bed4b974))

# [1.0.0-beta.6](https://gitee.com/vitarx/plugin-vite/compare/v1.0.0-beta.5...v1.0.0-beta.6) (2026-05-13)


### Bug Fixes

* **jsx:** 优化 JSXText 空白处理逻辑 ([b6b421b](https://gitee.com/vitarx/plugin-vite/commits/b6b421b5f253abd557c22e82e1e94b49fa70653c))

# [1.0.0-beta.5](https://gitee.com/vitarx/plugin-vite/compare/v1.0.0-beta.4...v1.0.0-beta.5) (2026-05-13)

# [1.0.0-beta.4](https://gitee.com/vitarx/plugin-vite/compare/v1.0.0-beta.3...v1.0.0-beta.4) (2026-05-10)


### Bug Fixes

* **props:** 将内联对象和数组属性改为生成 getter，修复响应性丢失问题 ([6be1f6a](https://gitee.com/vitarx/plugin-vite/commits/6be1f6a773e95b62f4bb51d02d5775d893be6237))

# [1.0.0-beta.3](https://gitee.com/vitarx/plugin-vite/compare/v1.0.0-beta.2...v1.0.0-beta.3) (2026-05-10)


### Bug Fixes

* **props:** 修复属性getter生成逻辑和支持null字面量 ([d102027](https://gitee.com/vitarx/plugin-vite/commits/d102027563a618e575d44b1b0991cac0b8f95c61))

# [1.0.0-beta.2](https://gitee.com/vitarx/plugin-vite/compare/v1.0.0-beta.1...v1.0.0-beta.2) (2026-05-09)


### Features

* **jsx:** 新增成员表达式组件支持 ([00ac940](https://gitee.com/vitarx/plugin-vite/commits/00ac9408b566cc7f0d8a373cecc478df4249cec4))

# [1.0.0-beta.1](https://gitee.com/vitarx/plugin-vite/compare/v1.0.0-beta.0...v1.0.0-beta.1) (2026-05-08)


### Bug Fixes

* **directives:** 修复 v-if 链处理BUG ([8fde9a2](https://gitee.com/vitarx/plugin-vite/commits/8fde9a27b9995bb205d9784a9b17a6c39f4f1f4f))
* **jsx-helpers:** 修正 v-if 指令的命名空间格式识别问题 ([b5678cc](https://gitee.com/vitarx/plugin-vite/commits/b5678ccb4c2d47972eeef05445b28518a3dae050))

# [1.0.0-beta.0](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-beta.8...v1.0.0-beta.0) (2026-05-07)


### Bug Fixes

* **config:** 修正 SSR 模式判定逻辑 ([0aa08f5](https://gitee.com/vitarx/plugin-vite/commits/0aa08f5410793bb1cf54e15c50096ab5d2a3e582))


### Features

* **vite-plugin:** 添加 pre 阶段执行配置 ([169e57c](https://gitee.com/vitarx/plugin-vite/commits/169e57c9944434720aa8ab929088e73ae6380355))

## [0.0.1-beta.8](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-beta.7...v0.0.1-beta.8) (2026-04-19)


### Features

* **package:** 添加transform子模块的类型和入口声明 ([69b354b](https://gitee.com/vitarx/plugin-vite/commits/69b354b86b973c6981196ebc3fc16364db3c0294))

## [0.0.1-beta.7](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-beta.6...v0.0.1-beta.7) (2026-04-02)


### Bug Fixes

* **core:** 修正类型声明和 sourcemap 生成问题 ([d4a717a](https://gitee.com/vitarx/plugin-vite/commits/d4a717a40deaa956acc37ed1fb4d346015cadb2b))
* **hmr-client:** 修复 UI_APIS 集合遗漏 'h' 标识符 ([1b33fc9](https://gitee.com/vitarx/plugin-vite/commits/1b33fc9a62c258e9360ac24bde2d5104549ddf82))
* **hmr-client:** 修正节点视图更新判断条件，兼容`vitarx >= 4.0.0.0-beta.8`版本 ([3a53f43](https://gitee.com/vitarx/plugin-vite/commits/3a53f434adae16f30140963f081824592dc21170))
* **vite:** 修正 viteTransform 函数返回类型和调用逻辑 ([faf8904](https://gitee.com/vitarx/plugin-vite/commits/faf89046a832e1f782b3521c460f24eccf21943b))

## [0.0.1-beta.6](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-beta.5...v0.0.1-beta.6) (2026-03-26)


### Bug Fixes

* **transform:** 修复模块判断逻辑导致转换错误 ([57635b4](https://gitee.com/vitarx/plugin-vite/commits/57635b4a55a358c7f27b5f6079ab5589394ba38c))


### Features

* **plugin:** 新增 className 转 class 功能 ([47553cd](https://gitee.com/vitarx/plugin-vite/commits/47553cd0052614ea3a26c74900242ce1d3d5da1a))

## [0.0.1-beta.5](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-beta.4...v0.0.1-beta.5) (2026-03-15)


### Bug Fixes

* **hmr-client:** 修复组件逻辑变化时的完全重挂载问题 ([0aad7a5](https://gitee.com/vitarx/plugin-vite/commits/0aad7a5b1a39d6ead243a07032d8eec3eaea006f))


### Features

* **types:** 添加条件渲染指令的类型声明 ([3f4bc9a](https://gitee.com/vitarx/plugin-vite/commits/3f4bc9a6aec231df001cf656ec8ed05fce1741e6))

## [0.0.1-beta.4](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-beta.3...v0.0.1-beta.4) (2026-03-10)


### Bug Fixes

* **imports:** 跳过 import type 和 import typeof 语句 ([29c0631](https://gitee.com/vitarx/plugin-vite/commits/29c06314d9200b404ab611d52999dae57b3baa49))


### Features

* **imports:** 优化导入说明符追加逻辑 ([4fbc491](https://gitee.com/vitarx/plugin-vite/commits/4fbc49187f3b08f38100203f1577f5ae080427e3))

## [0.0.1-beta.3](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-beta.2...v0.0.1-beta.3) (2026-03-06)


### Features

* **vite:** 添加针对不同版本vite的转换器支持 ([13f0f0d](https://gitee.com/vitarx/plugin-vite/commits/13f0f0d1f5118cc17cc445bb4b4b214519b81183))

## [0.0.1-beta.2](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-beta.1...v0.0.1-beta.2) (2026-03-05)


### Features

* **vite:** 升级兼容Vite 5-8版本的transform机制 ([a7b8ac0](https://gitee.com/vitarx/plugin-vite/commits/a7b8ac05da482d0736a1541c9e83f6159ec8fabb))

## [0.0.1-beta.1](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-alpha.2...v0.0.1-beta.1) (2026-03-04)


### Bug Fixes

* **directives:** 修复 v-if 指令链移除逻辑 ([930f3ec](https://gitee.com/vitarx/plugin-vite/commits/930f3ec62ab68a31848f583ac078b791f326b793))

## [0.0.1-alpha.2](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-alpha.1...v0.0.1-alpha.2) (2026-02-28)


### Bug Fixes

* **transform:** 修复源码映射处理逻辑 ([63c73f6](https://gitee.com/vitarx/plugin-vite/commits/63c73f6c44f422a7b90b0ed5b14e731dca5cd2d4))


### Features

* **props:** 支持 v-xxx:arg 格式的带参数指令 ([8ddabcb](https://gitee.com/vitarx/plugin-vite/commits/8ddabcb6f0111f1672f2b36bb18fb826b510cb30))

## [0.0.1-alpha.1](https://gitee.com/vitarx/plugin-vite/compare/v0.0.1-alpha.0...v0.0.1-alpha.1) (2026-02-28)

## [0.0.1-alpha.0](https://gitee.com/vitarx/plugin-vite/compare/9ea224bed92781e0282958ffd51ec790accc95c6...v0.0.1-alpha.0) (2026-02-28)


### Features

* 独立发布vite-plugin-vitarx插件 ([9ea224b](https://gitee.com/vitarx/plugin-vite/commits/9ea224bed92781e0282958ffd51ec790accc95c6))

