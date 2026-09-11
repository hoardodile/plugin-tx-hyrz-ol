# Character Frame Animation（hoardodile 插件）

一个 **2D 精灵帧动画**演示插件：把**已导出的自包含角色目录**（或含
`catalog.json` 的合集目录）在 hoardodile 里播放出来——默认一屏同时预览全部动作，
也可以切到检视模式按帧播放、切换动作、查看每帧的图层与音效。

角色是 2D 精灵帧动画：五层绘制层，每层一条精灵换帧曲线，加上位移/缩放/旋转曲线，
30 fps，单角色约 150 张精灵、约 75 个动作。

> 本仓库**只做消费端**：解析并渲染导出数据。导出格式见
> [`docs/format.md`](docs/format.md)；生成数据的工具是另一个（不公开的）项目，
> 不在本仓库内，仓库里也不含任何游戏数据。

---

## 1. 目录结构

```
src/kernel/            纯函数内核（采样、图集数学、事件调度、分组）——无 IO、无 Effect
src/boundary/          Effect 边界（Schema 解码、资源加载、音频播放）
src/ui/                React + @hoardodile/ui 视图与 canvas 渲染
scripts/               testdata 生成、workbench 启动、内核纯度 / readme 门禁
testdata/              合成的最小角色，供 `pnpm dev` 与单测使用
docs/format.md         导出数据格式（消费端契约）
```

## 2. 环境与依赖

- Node ≥ 24、pnpm 11、Biome（格式化 + 基础 lint）、Vitest、Effect v4（rc）
- 数据：一个**已导出**的角色目录或合集目录（插件不附带数据）

```bash
pnpm install
pnpm build
pnpm dev          # 用 testdata/ 里的合成角色起 workbench
```

## 3. 在 workbench 里预览

```bash
pnpm dev                                   # 合成 fixture（testdata/）
pnpm dev:data --data <dir>                 # <dir> 里的第一个角色
pnpm dev:data --data <dir> <id>            # 指定角色
pnpm dev:data --data <dir> --all           # characters/ 下每个角色一个 resource
pnpm dev:data --data <dir> --collection    # characters/ 作为合集 resource（含角色选择器）
```

`--data` 可以指向**导出根目录**（其中含 `characters/`）、`characters/` 目录本身，
或**单个角色目录**（根含 `character.json`）；也可以用环境变量 `FRAME_DATA_ROOT`。
导出数据不在本仓库内，路径需要手动给。打开 http://127.0.0.1:5199 。

视图有两种模式，切换就在底部控制栏最右侧；**第一次打开是预览，之后记住上次选的模式**：

- **预览（默认）**：一屏同时播放该角色的**全部动作**，不需要任何设置。
  每个动作一块，按「全帧包围盒」（该动作所有帧绘制范围的并集，含各层的位移）确定尺寸、
  **永远按原始像素（1:1）显示**，不做放大缩小；
  块之间用 flex 自动换行排布（瀑布流式），大小不一的动作各自占自己的位置，放不下就纵向
  滚动。预览**不播放声音**（不加载 `audio-map.json`，也没有任何播放路径）。每块标签常显
  动作名与帧数。
- **检视**：左侧是动作密表（搜索 + 分类筛选 + 每行帧数/毫秒/音效事件数），中间是
  **1:1 原生尺寸**的画布（动作用整帧包围盒放进画布，只缩不放），下面是**帧条**（当前动作的
  真实帧缩略图横向排列，整帧缩放进格子、可点选定位、播放头高亮）；右侧面板顶部的
  **Loop / 自动下一个 / Sound 三个开关各占一行**，往下是**当前帧检视器**：
  本帧绘制的层表（层/精灵/位置/缩放/旋转）、本帧音效事件（可试听、非 1.0 音量显示
  `x0.50` 角标、未解析明确标注）、精灵与图集信息，事件映射收在按钮打开的对话框里。
  右侧面板与左侧动作表都跟随窗口宽度自动显隐（见下）。

  「**自动下一个**」是一次只播一个动作：播完立刻切到动作表里的下一个（最后一个之后回到
  第一个），并且**把 Loop 开关关掉并置灰**——两者互斥，因为循环的时钟永远到不了动作结尾。
  这个互斥是**覆盖**而不是改写：关掉「自动下一个」之后，Loop 会回到用户原来存的设置。

两种模式的选择和检视里的三个开关都是**插件偏好（pref）**，不是组件状态：一改就写进宿主的
偏好存储（`setPref`），下次打开、换角色、换合集、重载 iframe 都还是这个选择。键名与默认值：

| pref 键 | 默认 | 含义 |
| --- | --- | --- |
| `view.mode` | `preview` | 打开哪个视图（`preview` / `inspect`） |
| `viewer.loop` | `true` | 循环播放当前动作 |
| `viewer.autoNext` | `false` | 播完一个动作就切下一个（覆盖 `viewer.loop`） |
| `viewer.sound` | `false` | 播放该动作的音效事件 |

偏好值在宿主里是**字符串**，所以每个键都带 codec（布尔用 `booleanCodec()`，视图用一个
两值 codec，读到别的值就当「缺失」）：不带 codec 时存进去的 `false` 会以字符串 `"false"`
读回来，而非空字符串恒为真——开关就会永远显示为开。
在 workbench 里调试：**Settings → Plugin state → Reset** 清空偏好（本地覆盖，不动真实库）。

两种模式的底部是同一条控制栏（顺序一致）：**播放/暂停、重播、实时读数、查看模式切换**；
合集资源还会在最右侧多一个**角色选择器**（带搜索的下拉）。**没有缩放、速度与逐帧按钮**：
帧动画固定按导出数据的原始像素与原始帧率播放，定位靠帧条点选。预览模式的读数显示动作数，
检视模式显示 `第 N / M 帧 · 毫秒`。

检视模式的两个侧栏按设计库的布局断点自动显隐：
左侧动作表在窗口宽度 ≥ 1150（`sidebar`）时显示，右侧当前帧面板在 ≥ 1440（`panel`）时显示，
更窄时把宽度让给画布。

## 4. 导出数据长什么样

完整字段见 [`docs/format.md`](docs/format.md)。要点：

- **每个角色一个自包含目录**：`character.json` + `atlas/*.png` + `audio/*.ogg` +
  `audio-map.json` + `cover.png`。整个目录可以单独拷走，删掉其它角色也不影响它。
- **合集**：根目录一个 `catalog.json`（`counts.characters` / `counts.portraits`）
  加上 `characters/<id>/…`。带 `characters/catalog.json` 的精简合集只含角色目录，
  宿主扫描时不会去遍历成千上万的音频样本。
- **动作分组由导出端写入** `clips[].group`（`idle|move|attack|skill|damage|state|other`），
  前端只读不猜：命名约定属于导出端，不属于消费端。旧文档缺这个字段时归入 `other`。
- **图集页在导出时就已经去过邻接碎图**（精灵矩形在原始打包里会互相重叠，靠
  tight mesh 裁切）。因此 `character.json` 只写 `rect`/`pivot`/`pixelsToUnit`，
  渲染就是一次普通矩形贴图，`docs/format.md` 里也**没有** mesh 字段。
- **音量**：事件字符串是 `路径;音量[;flag]`，导出时拆开，音量写进同帧的 `volumes`
  （全为 1.0 时省略整个字段）。

## 5. 渲染：锐利度

canvas 之前按 `DPR × zoom` 缩放、只在整数倍时用最近邻——在 Windows 125% 缩放、
浏览器缩放或非整数 zoom 下，每个图素对应的设备像素不是整数，浏览器只能重采样，
于是「很多帧发糊」。现在：

- 缩放吸附到**整数设备像素**（`pixelExactScale`：放大取整、缩小取 1/n），
  一个图素 = 整数个设备像素；
- **1:1 与放大一律最近邻**（不插值），只有动画确实把图层缩到小于原始尺寸
  （`deviceScale < 1`，真降采样）时才开插值，否则会丢像素产生锯齿；
- 源矩形与目标矩形都对齐整像素（`integerSourceRect` + 设备像素吸附），
  1:1 贴图不再被采样。

实测 DPR=1、zoom=1：`source=[683,277,55,159] → dest=[-23,-146,55,159]`，
尺寸完全一致、全为整数、`imageSmoothingEnabled=false`。

宿主会把资源卡片封面缩到约 547²，所以 `cover.png` 由导出端预渲染成 768² 正方形：
封面是 idle 首帧整层合成 + **整数倍最近邻**放大，卡片只会缩小、不会插值。
workbench 会把渲染好的封面按资源 id + 路径缓存在 `.hoardodile/cache/`，换封面后要
清掉才会更新。

## 6. 架构：纯内核 + Effect 边界

- `src/kernel/**`：**纯函数**（严格函数式）——`layersAt` 采样某时刻的图层、
  `quadFor`/`atlasSource` 图集数学、`clipBoundsFrames` 逐帧求全帧包围盒（把每层按
  pivot 摆放后的绘制矩形并集起来，含位移，供 1:1 定尺寸用）、
  `fitViewport`/`fitClipView`/`quantizeFit` 求「不放大、只居中」
  的缩放与原点、`dueEvents` 按帧调度音频（含循环回绕）、`classifyClips` 按导出端写入的
  `group` 分组。
  无 IO、无 DOM、无 Effect、无 `let`/循环/class/`this`/`throw`/`await`。
- `src/boundary/**`：**Effect v4**（`effect@4.0.0-rc`）——`Schema` 解码
  `character.json`/`catalog.json`/`audio-map.json`（失败即 `Schema.TaggedError`）、
  `Context.Service` + `Layer` 提供资源访问与 `AudioPlayer`、
  `ManagedRuntime` 从 React 侧运行。
- `src/ui/**`：React + `@hoardodile/ui`（只走子路径导入、只用语义 token、
  canvas 绘制走内核返回的几何），渲染循环用 rAF，不套 Effect。`playback` 时钟与音效调度
  收在 `usePlayback`（预览不传 `emit`，所以预览在代码路径上就不可能出声；循环与否由调用方
  传入，因为它是用户偏好）。`useViewerPrefs` 用 SDK 的 `usePref` + codec 把「哪个视图」和
  检视的三个开关接到宿主偏好存储上。canvas 按 DPR
  建后备缓冲、把四边形对齐**整设备像素**、缩放吸附到整数设备倍数；`paint.ts` 是预览格子、
  帧条缩略图与检视画布共用的绘制函数。

## 7. 质量门禁

```bash
pnpm lint        # biome check + 内核纯度门禁 + tsc --noEmit
pnpm format      # biome check --write
pnpm test        # Vitest：内核采样/图集/事件/分组 + 插件钩子 + 五语文案一致性 + 真实文档解码
pnpm build       # 插件产物 dist/
pnpm testdata    # 重新生成 testdata/ 合成角色
pnpm readme:check# 门禁 readme/（市场用的扁平 README 与图片引用）
```

关于 lint 工具：本仓库把 TypeScript 固定在 7.x（原生编译器），
`typescript-eslint` 与 `eslint-plugin-functional`（依赖 `ts-api-utils`）在 TS 7 下
**无法加载**，因此「严格函数式」由 `scripts/check-kernel-purity.mjs` 直接对
`src/kernel/**` 做语法门禁（禁 `let`/循环/class/`this`/`throw`/`await`/DOM/
时间与随机源），Biome 负责格式化与常规规则（`biome.json` 的 `overrides` 对
内核额外开启 `useConst`/`noVar`/`noParameterAssign`/`noExplicitAny`）。
边界与 UI 层允许必要的命令式写法，但数据一律只读。

把真实数据接进测试（可选）：

```bash
FRAME_DATA_ROOT=<导出根目录> pnpm test    # 额外解码一批真实 character.json
```

## 8. 插件契约速查

- `src/main.ts`：`detect`（识别「含 `character.json` 的自包含角色目录」或
  「含 `catalog.json` 的合集根」）、`sourceMeta`（角色摘要 / 合集规模）、
  `coverLocal`（`cover.png`）、`listFiles`（`document|atlas|audio|other`）
- `src/shared.ts`：`FrameSchema` 同时约束服务端与客户端
- `manifest.json`：`ui.card` 的封面模板（`ui.card.{image,default}`，模板里只用
  `t('...')` 并已声明 i18n key）
- 退出 watch 后重新构建：`pnpm build`；发布：`pnpm release <version>`

## 9. 说明

- 本仓库**不含**任何游戏资源，也不含解包工具；`unpacked/` 与 `.hoardodile/`
  都在 `.gitignore` 内。
- 特效、特效音频、3D 模型、骨骼动画半身像、技能视频、代码还原均**不在**本插件范围内。
- 角色配置里的 `attribute<哈希>` 曲线（脚本字段，不是 Transform）会照原样保留在
  `character.json` 里但不参与绘制；`rotation`（四元数）同理。
