# SD WebUI Infinite Canvas

一个无限画布插件，适用于 [WebUI Forge - Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)。

## 特性
- 无限扩展的瓦片画布，支持超大画幅
- 取景框自由移动、缩放、旋转，控制生成区域
- 多种蒙版绘制工具：矩形、画笔、椭圆、橡皮擦、魔法棒（SAM 2.1）
- 带边缘修复的局部重绘 / 扩图
- 生成后预览模态框，支持羽化调节
- 插件化生成管线（LLM 提示词优化、ControlNet、Latent Blend、高清修复等）
- 工程保存 / 加载（含自动保存）
- 画布与蒙版独立的撤销 / 重做
- 自动裁剪、复制画布、下载画布、上传底图
- WebSocket 实时进度推送
- 中英双语界面

## 安装
1. 打开 WebUI
2. 选择 Extensions 导航栏，选择 Install from URL
3. 粘贴 repo 的 URL 然后点击 Install
4. 重启 WebUI

## 使用方法

### 界面概览

插件界面由以下区域组成：

- **无限画布**：占据主区域，显示瓦片拼接的完整画面
- **浮动工具栏**（底部居中）：所有工具、操作按钮、分辨率预设、生成 / 中断按钮
- **侧边栏**（右侧，可折叠 / 展开）：生成参数、插件设置、管线节点
- **预览模态框**（生成后弹出）：Before / After 对比，羽化调节，应用 / 放弃

### 概念：无限画布

本插件中，图像生成的输入和输出均来自无限画布，并最终合并回无限画布。画布由 **1024×1024 的瓦片** 拼接而成，支持负坐标，最大 16384×16384 像素。画布可以任意平移和缩放，超出视野的瓦片不会渲染。

### 概念：取景框（蓝色虚线框）

取景框是画布上用于截取生成输入的区域，显示为蓝色虚线矩形框。**生成时，框内的画布内容将作为模型的输入图像**。

取景框操作：
| 操作 | 方式 |
|------|------|
| 移动取景框 | 在框内按住 `Alt + 左键` 或 `右键` 拖拽 |
| 缩放取景框 | 在框内使用 `鼠标滚轮` |
| 旋转取景框 | 任意位置按住 `Shift + 左键` 拖拽 |
| 重置取景框（位置 / 角度 / 缩放） | 在框外按 `鼠标中键`；`Alt + 鼠标中键` 同时重置位置、大小与旋转 |

取景框具有两个分辨率概念：
- **逻辑分辨率**（框的实际像素尺寸）— 决定画布上框的大小
- **生成分辨率**（侧边栏中设定的 `width × height`）— 决定送入模型的实际分辨率

**自动缩放画布**：开启时（工具栏 Auto Scale 高亮），如果逻辑分辨率低于生成分辨率，画布会自动放大使两者一致，确保生成的图像细节不丢失。关闭时，生成结果会被缩放到逻辑分辨率贴回画布。

**特别地**：当框内画布为空（透明），且没有蒙版时，会自动切换为 **文生图** 而非图生图。

### 概念：蒙版

蒙版决定了生成时哪些区域会被重绘。白色区域 = 需要重绘，黑色区域 = 保留原图。

蒙版操作：
| 操作 | 方式 |
|------|------|
| 绘制蒙版 | 选择工具后用 `鼠标左键` 在画布上拖拽 |
| 撤销蒙版 | `Ctrl + Z` 或工具栏 Mask ↶ 按钮（最多 30 步） |
| 重做蒙版 | `Ctrl + Shift + Z` / `Ctrl + Y` 或工具栏 Mask ↷ 按钮 |
| 清除蒙版 | 工具栏 Clear Mask 按钮 |
| 蒙版笔画粗细 | 选择画笔 / 橡皮擦 / 魔法棒工具后，工具栏弹出滑块调节 |

> 蒙版仅取景框内的部分有效，框外部分会被自动剔除。缩放取景框时，蒙版会尽量无损迁移。蒙版逻辑分辨率不会超过取景框实际分辨率的两倍。

### 绘制工具

工具栏提供了 5 种蒙版绘制工具：

| 工具 | 图标 | 说明 |
|------|------|------|
| **矩形** (Rect) | □ | 拖拽绘制矩形蒙版区域 |
| **画笔** (Brush) | 🖌 | 自由绘制，支持笔画粗细调节 |
| **椭圆** (Ellipse) | ○ | 拖拽绘制椭圆蒙版区域 |
| **橡皮擦** (Eraser) | ✂ | 擦除已有蒙版，支持粗细调节 |
| **魔法棒** (Magic Wand) | ✦ | 点击蓝框内任意位置，调用 SAM 2.1 模型自动分割 |

> 魔法棒工具首次使用时会自动下载 SAM 2.1 Tiny 模型（约 40MB），下载时间取决于网络情况。后续使用无需重新下载。

### 画布导航

| 操作 | 方式 |
|------|------|
| 平移画布 | 在蓝框外按住 `Alt + 左键` 或 `右键` 拖拽 |
| 缩放画布 | 使用 `鼠标滚轮` |
| 回正相机 | 按 `鼠标中键`（重置缩放和偏移，定位到取景框） |

### 生成流程

1. **调整取景框** — 移动、缩放、旋转蓝框，确定生成区域
2. **绘制蒙版**（可选）— 若不需要局部重绘，可跳过
3. **配置参数** — 在侧边栏调整提示词、步数、CFG、采样器等
4. **点击 Generate** — 工具栏蓝色按钮
5. **等待进度** — 工具栏实时显示当前步骤（带颜色指示）
6. **预览确认** — 模态框弹出，Before / After 对比
7. **调节羽化** — 拖动 Feather Radius 滑块，实时预览融合效果
8. **应用或放弃** — Apply Changes 将结果写入画布；Discard 丢弃

生成过程中可随时点击 **Interrupt**（红色按钮）中断。

### 预览模态框

生成完成后弹出，包含：

- **左侧**：生成前（Before）— 取景框内的原始画布内容
- **右侧**：生成后（After）— 模型输出，叠加羽化蒙版混合效果
- **底部工具栏**：
  - Feather Radius 滑块（0–64px）— 控制蒙版边缘羽化强度
  - Highlight Edge Fix 按钮（有边缘修复时显示）— 高亮显示修复区域
  - Discard — 放弃生成结果
  - Apply Changes — 应用结果到画布

### 画布撤销 / 重做

与蒙版撤销不同，画布撤销 / 重做针对的是 **生成结果的应用**：

| 操作 | 按钮 |
|------|------|
| 画布撤销 | 工具栏 ↶ Canvas（回到上一步生成前） |
| 画布重做 | 工具栏 Canvas ↷ |

> 每次 Apply Changes 前会自动保存画布快照，可在生成后随时回退。

### 分辨率预设

工具栏底部提供了 8 个快速分辨率预设按钮，覆盖常见 SD 宽高比：

- `1024×1024` (1:1)
- `832×1216` / `1216×832` (约 2:3 / 3:2)
- `1024×1280` / `1280×1024` (4:5 / 5:4)
- `768×1344` / `1344×768` (约 9:16 / 16:9)
- `704×1472` / `1472×704` (约 1:2 / 2:1)

点击预设会自动更新侧边栏的 width/height 参数。

### 工具栏功能按钮

| 按钮 | 说明 |
|------|------|
| Auto Save | 切换自动保存（默认开启），自动保存每 60 秒触发 |
| Show Overlays | 切换蒙版覆盖层显示（红色半透明） |
| Auto Scale Canvas | 切换自动缩放画布 |
| Clear Mask | 清除当前蒙版 |
| Auto Crop | 自动裁剪画布透明边缘（支持裁纯黑 / 纯白两种模式） |
| Reset Canvas | 完全重置画布（清空所有瓦片） |
| Download Canvas | 下载画布为 PNG（自动裁剪透明边，使用工程名称） |
| Copy Canvas | 复制画布到剪贴板 |
| Upload Base Image | 上传 PNG/JPG/WebP 作为底图（支持 WebUI PNG 元数据导入） |
| Projects | 打开工程管理模态框 |

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Z` | 蒙版撤销 |
| `Ctrl + Shift + Z` / `Ctrl + Y` | 蒙版重做 |
| `` ` `` (反引号) | 切换调试覆盖层（显示瓦片网格和坐标） |
| `ESC` | 打开 / 关闭开发者面板 |
| `鼠标中键` | 回正相机到取景框 |
| `Alt + 鼠标中键` | 重置取景框位置、大小、角度 |
| `Shift + 左键拖拽` | 旋转取景框 |
| `Alt + 左键拖拽` | 平移画布或移动取景框 |

### 侧边栏与管线节点

侧边栏包含：

- **折叠状态**：仅显示提示词输入框（带语法高亮）
- **展开状态**：显示完整参数面板

#### 管线节点

侧边栏底部显示彩色节点条，代表生成管线的每个步骤（按 sort_index 排序）。每个节点展示：
- 节点名称（如 ParseInput、FirstPass、EdgeFix）
- IN / OUT 类型签名徽章
- 错误指示器（红色 X 圆点，表示类型不兼容）

点击节点可展开其参数面板。每个插件可通过 `enabled` 开关独立启用 / 禁用。

#### 参数类型

参数行根据类型自动渲染：
- **文本** (text) — 带语法高亮的 textarea（提示词括号匹配、LoRA/Lyco 着色）
- **布尔** (bool) — 复选框
- **浮点 / 整数** (float / int) — 数字输入框 + 范围滑块联动
- **枚举** (enum) — 自定义下拉搜索框
- **密码** (password) — 密码输入框（如 API Key）
- **随机种子** (randomseed) — 数字输入框 + ↻ 复用种子 + 🎲 随机（设为 -1）

### 工程管理

点击工具栏 **Projects** 按钮打开工程模态框：

- **保存工程**：输入工程名 → Save，保存为 `.infcanvas` ZIP 文件（v3 格式）
- **加载工程**：从列表中选择，自动恢复画布瓦片、蒙版、管线配置、视口状态
- **导入工程**：导入本地 `.infcanvas` 文件
- **自动保存**：开启后每 60 秒自动保存到当前工程（切换工程时检测新版本）
- **自动恢复**：加载工程时如检测到更新的自动保存，弹出恢复确认框

工程文件 (`*.infcanvas`) 是 ZIP 压缩包，包含：
- `meta.json` — 版本、画布边界、管线配置、视口状态
- `canvas_t_*.webp` — 每块 1024×1024 瓦片（WebP 无损）
- `canvas_prev_t_*.webp` / `canvas_now_t_*.webp` — 撤销 / 重做快照瓦片
- `mask.webp` — 拼接蒙版

### 边缘扩展选项

当取景框旋转或超出已有画布边界时，边缘填充模式：

| 模式 | 说明 |
|------|------|
| Black | 纯黑填充 |
| White | 纯白填充 |
| Extend Edge | 使用 scipy 距离变换扩展边缘像素 |
| Edge Blur | 使用 OpenCV Telea 修复 + 高斯模糊平滑边缘 |

### 内置插件

所有插件可在侧边栏管线节点中独立启用 / 禁用：

| 插件 | 说明 |
|------|------|
| **LLM Prompt Optimizer** | 调用 OpenAI 兼容 API，将自然语言提示词扩展为 SD Tag 风格；支持 LRU 缓存（100 条）、保留 `<lora:...>` 令牌 |
| **Append Close-Up** | 简单追加 `, close-up` 到提示词末尾 |
| **Prompt Review** | 生成前暂停，弹出对话框供手动编辑提示词 / 负面提示词 |
| **Latent Edge Blend** | 在潜空间层面进行边缘融合，使用高斯模糊软蒙版 + 自定义融合强度公式 |
| **SD ControlNet** | ControlNet 集成，支持从上游管线节点动态选择输入图像 / 蒙版源 |
| **Cross Attention Injector** | 交叉注意力注入，在生成过程中修改注意力图以引导风格，移植自[https://github.com/An1X3R/Anima-Artist-Mixer] |
| **FirstPass Review** | 首次生成后暂停，显示生成图像供审查，可选择继续或取消 |
| **Hires Fix** | 高清修复：自动切换 Txt2Img→Img2Img，调用内置 SDUpscale 进行分块放大 |
| **Edge Fix** | 边缘二次修复：检测 delta 蒙版边缘（>5px 差异），距离变换生成软边缘蒙版，进行第二次修复性重绘 |

### 管线流程

```
ParseInput (0) → PrepareCanvas (10) → LLMPromptOptimize (15)
  → AppendCloseUp (18) → PromptReview (19)
  → SetupProcessing (20) → LatentBlend (30) → SdControlNet (40)
  → CrossAttnInjector (45) → FirstPass (100)
  → FirstPassReview (101) → SecondPass (102)
  → EdgeFix (500) → FinalizeState (1000)
```

每个步骤通过类型化记录系统传递数据，插件可声明输入 / 输出类型以进行管线兼容性验证。

### 类型检查 (Type Checking)

#### 概述

管线中的每个步骤通过 `type_signature()` 声明其输入和输出类型。前端渲染管线节点时，会自动发起 `POST /canvas/validate_workflow` 验证整个管线的类型兼容性。不兼容的节点会显示 **红色 X 错误徽章**，提示缺失的上游输出或未闭合的管线末端。

#### 类型词汇表

所有类型定义在 [scripts/typing_system.py](scripts/typing_system.py) 中，分为三个层级：

**基础类型** — 从 `IC_Type` 基类派生，支持泛型参数 (`Array[Float, 3]`) 和类型映射 (`Prompt >> Prompt`)：

| 类别 | 类型 | 说明 |
|------|------|------|
| 通配 | `AnyType`, `AnySize` | 匹配任意类型 / 任意尺寸 |
| 原语 | `String`, `Float`, `Int`, `Boolean` | 基础数据类型 |
| 泛型 | `Array[T, ...]` | 数组 / 张量（`...` = 不定维度） |
| 泛型 | `Var[Name, Type]` | 具名类型变量（用于动态输入源选择） |
| 张量 | `Float4`, `Float3` | 4 通道 / 3 通道浮点张量 |
| 张量 | `Image4`, `Image3`, `Image1` | 4 通道 / 3 通道（RGB）/ 1 通道（灰度）图像 |

**语义类型** — 表达管线中的领域概念：

| 类型 | 基类 | 含义 |
|------|------|------|
| `Prompt` | `String` | 正向提示词 |
| `NegativePrompt` | `String` | 负面提示词 |
| `SamplerConfig` | `IC_Type` | 采样器配置（步数/CFG/Seed 等） |
| `Resolution` | `IC_Type` | 生成分辨率 |
| `CanvasConfig` | `IC_Type` | 画布配置（边缘填充/放大算法等） |
| `InputImage` | `Image3` | 输入图像（RGB） |
| `InputMask` | `Image1` | 输入蒙版（灰度） |
| `GeneratedImage` | `Image3` | 生成图像（中间产物） |
| `FinalOutputImage` | `GeneratedImage` | 最终输出图像（管线必须以此结尾） |
| `SdProcessing` | `IC_Type` | Stable Diffusion 处理对象 |
| `ControlNetLayer` | `IC_Type` | ControlNet 配置层 |
| `LatentBlend` | `IC_Type` | 潜空间融合配置 |
| `SoftStop` | `IC_Type` | 软停止信号（非错误中断） |
| `Error` | `String` | 错误信息 |
| `UsedSeed` | `Int` | 实际使用的种子值 |

#### 类型签名 (Type Signature)

每个步骤的 `type_signature()` 返回 `{"in": [...], "out": [...]}`：

- **`in`**：该步骤**消费**的类型列表。验证时检查上游是否已有步骤生产这些类型。
- **`out`**：该步骤**生产**的类型列表。验证时追加到可用类型池供下游匹配。

类型匹配通过 `match_type()` 引擎进行，支持：
- **直接子类匹配**：`InputImage` 是 `Image3` 的子类，匹配成功
- **泛型匹配**：`Var[..., Image3]` 中的 `...` 为通配符，匹配任意具名的 `Image3` 子类型
- **映射匹配**：`Prompt >> Prompt` 表示读入 Prompt 并写出 Prompt

**闭包排除规则**：`ctx.var`（步骤参数）和 `ctx.step_params` 不算类型数据流的一部分，只有通过 `ctx.set()` 写入的类型化记录才参与验证。

#### 验证规则

`validate_pipeline()` 按 sort_index 顺序遍历所有已启用的步骤，维护一个 `available_types` 池：

1. **输入检查**：对每个步骤的 `in` 中的每个类型，检查 `available_types` 中是否存在匹配。不匹配 → 错误徽章，提示 "Requires input 'X', but it is not provided by any upstream step"
2. **输出追加**：步骤的 `out` 类型全部加入 `available_types`
3. **末端检查**：管线末尾必须存在 `FinalOutputImage`，否则最后一个步骤报错 "Pipeline does not output 'FinalOutputImage' at the end"

**禁用插件**：`is_plugin=True` 且 `enabled=False` 的步骤会被跳过，不参与类型验证。

#### 动态输入源解析

`Var[Name, Type]` 允许插件在运行时从上游步骤的输出中动态选择输入源。例如 `SdControlNet` 声明 `in: [..., Var[..., Image3], Var[..., Image1]]`，其 `get_params()` 调用 `get_pipeline_choices()` 扫描上游已注册的 `Image3` / `Image1` 生产者，填充为下拉选项。用户可在 UI 中选择具体的数据源（如 "从 ParseInput 的 InputImage" 或 "从 PrepareCanvas 的 InputImage"）。

#### 前端表现

管线节点条中每个节点显示：
- **类型徽章**：左侧蓝色 IN 徽章 + 右侧绿色 OUT 徽章，展示该步骤的输入 / 输出类型名称
- **错误指示器**：红色圆形 X 图标，hover 显示具体错误原因
- **展开签名**：点击节点展开参数面板时，头部显示完整的 IN → OUT 类型签名

## 示例工程

在插件根目录下有 `tutorial.infcanvas` 文件，可加载此工程后直接点击 Generate 按钮，观察效果。

建议搭配 `anima` 模型使用。

## 开发者面板

按 `ESC` 键打开开发者面板，提供：

- **Rebuild JS** — 重新拼接 `src/js/*.js` → `javascript/infinite_canvas.js`（仍需手动刷新浏览器）
- **Reload Python Logic** — 热重载 `core_logic` 和 `node_manager` 模块（不重载 `canvas_state`，不重载插件）
- **Dependency Graph** — 在新窗口打开 Mermaid 管线类型依赖图

## 说明

本项目 99.8% 为 Vibe Coding。现在 README 也为 LLM 生成，我进行了 gitignore 的工作，因为项目增大被迫还检查了其它部分。

插件本身是图生图的扩展，假如图生图可以工作，那插件就有可能工作。
