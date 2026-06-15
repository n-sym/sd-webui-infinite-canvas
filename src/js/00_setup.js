const isZh = (navigator.language || navigator.userLanguage || '').toLowerCase().startsWith('zh');

function t(enStr) {
    if (!isZh) return enStr;
    const dict = {
        'Continue Previous Session?': '是否继续上次的会话？',
        'Start Fresh': '重新开始',
        'Restore Canvas': '恢复画布',
        'Before': '原图',
        'After': '预览',
        'Feather Radius (px): ': '羽化强度 (px): ',
        '❌ Discard': '❌ 放弃更改',
        '✅ Apply Changes': '✅ 应用更改',
        'Canvas': '画布',
        'Mask': '蒙版',
        'Reset Canvas': '重置画布',
        'Download Canvas': '下载画布',
        'Auto Crop': '自动裁剪',
        'Crop Pure Black': '裁剪纯黑边缘',
        'Crop Pure White': '裁剪纯白边缘',
        'Clear Mask': '清除蒙版',
        'Upload Base Image': '上传底图',
        'Canvas & Mask Parameters': '画布与蒙版参数',
        'Project Management': '工程管理',
        'Project Name': '工程名称',
        'Save Project': '保存工程',
        'Load Project': '读取工程',
        'Import Project': '导入工程',
        'Plugin Settings': '插件设置',
        'Search settings...': '搜索设置...',
        'LLM Prompt Optimizer': 'LLM 提示词优化',
        'Enable': '启用',
        'API URL': 'API 地址',
        'API Key': 'API 密钥',
        'Model Name': '模型名称',
        'Detail Richness': '细节丰富度',
        'Prompt Fidelity': '原文遵从度',
        'Language Style': '语言风格',
        'Mixed': '混合（默认）',
        'Pure Natural Language': '完全自然语言',
        'Pure Tag Style': '完全Tag风格',
        'Prefix Tags': '前缀标签',
        'Character & Series': '角色与系列',
        'Artist & Style': '画师与风格',
        'Enable LRU Cache': '启用缓存 (节省Token)',
        'Pipeline Nodes': '执行节点',
        'Latent Edge Blend': '潜空间边缘融合',
        'Blend Power': '融合强度',
        'Edge Fix Post-Process': '边缘二次修复',
        'Fix Power': '修复强度',
        'Append Close-Up': '末尾追加close-up',
        'SD-Style Input': 'SD风格输入',
        'Prepare Canvas': '画布预处理',
        'Setup SD': '设置SD',
        'Generation': '图像生成',
        'Get Final Image': '结束',
        'FirstPass Review': 'FirstPass预览审查',
        'Mask Tool': '蒙版工具',
        'Show Overlays': '显示覆盖层',
        'Auto Scale Canvas': '自动缩放画布',
        '🔆 Highlight Edge Fix': '🔆 高亮显示修复边缘',
        'Edge Fix': '边缘二次修复（可能修改蒙版外区域，慢）',
        'Edge Fix Power (t)': '边缘修复强度 (t)',
        'Latent Edge Blend (Unsafe)': '潜空间边缘融合 (不安全)',
        'Dynamic Blend Power (0=Static)': '动态融合衰减度 (0=静态)',
        'Generation Parameters': '生成参数',
        'Rect': '矩形',
        'Brush': '画笔',
        'Ellipse': '椭圆',
        'Eraser': '橡皮擦',
        '🪄 Magic Wand': '🪄 魔法棒',
        'Brush Size': '笔刷粗细',
        'Click inside the blue box to auto-segment': '点击蓝框内部进行自动抠图',
        'Copy Canvas': '复制画布',
        'Show Overlays': '显示覆盖层',
        'Auto Scale Canvas': '自动缩放画布',
        'Copied!': '已复制！',
        'Guide': '操作指南',
        '📖 Infinite Canvas Guide': '📖 无边画布使用指南',
        '👆 Basics & Navigation': '👆 基础操作与导航',
        'Pan Canvas': '平移画布',
        'Hold <kbd>Alt</kbd> + Left click / Right click outside the blue box to pan the canvas. Click Middle Mouse Button to reset camera.': '在蓝框外部按住[Alt + 左键] / [右键]拖拽以平移整个画布。点按[鼠标中键]以将相机回正。',
        'Zoom Canvas': '缩放画布',
        'Use the mouse wheel to zoom in and out.': '使用[鼠标滚轮]进行放大和缩小。',
        '🟦 The Generation Area (Blue Box)': '🟦 生成区域',
        'Properties': '性质',
        'Appears as a blue dashed box. This area is fed into the generation model, hereafter referred to as the [Blue Box].': '体现为一个蓝色虚线框。该区域会被输入进生图模型，下面简称【蓝框】。',
        'Move Box': '移动蓝框',
        'Hold <kbd>Alt</kbd> + Left click / Right click inside the blue box to move it.': '在蓝框内部按住[Alt + 左键] / [右键]拖拽即可移动蓝框。',
        'Rotate Box': '旋转蓝框',
        'Hold <kbd>Shift</kbd> + Left click drag anywhere to rotate the blue box.': '在任何位置按住[Shift + 左键]拖拽，即可自由旋转蓝框。',
        '🖌️ Drawing Masks': '🖌️ 绘制蒙版',
        'Drag with the Left Mouse Button anywhere to draw masks. Masks outside the blue box will be ignored.': '直接使用鼠标左键在任意位置拖拽，即可绘制蒙版。不存在于蓝框内的蒙版会被剔除。',
        'When scaling the blue box, masks will be preserved as losslessly as possible.': '放大或缩小蓝框时，蒙版会被尽量无损地迁移。',
        'The logical resolution of the mask will not exceed twice the actual resolution of the blue box.': '蒙版的逻辑分辨率不会大于蓝框实际分辨率的两倍。',
        'Mask operations can be undone/redone. Panning is not considered a mask operation. Undo is bound to <kbd>Ctrl + Z</kbd>.': '蒙版操作可以被一定程度上撤销和重做，平移不被视为蒙版操作。该操作也绑定到[CTRL + Z]。',
        'The Magic Wand tool uses the SAM model, which requires an additional download and may take time depending on network conditions.': '使用魔棒工具会调用SAM模型，该模型需要额外下载，可能需要一些时间，依赖于网络情况。',
        '🔄 Undo/Redo & Generation': '🔄 撤销重做与生成',
        'After generation, a preview modal will pop up. You can adjust feathering before applying.': '生成完成后，会弹出预览确认框，你可以在应用前调整边缘羽化。',
        'You can use the Canvas Undo/Redo buttons in the toolbar to revert your actions anytime.': '你可以随时使用工具栏的【画布撤销/重做】按钮来回退你的操作。',
        '💾 Project Management': '💾 工程加载和保存',
        'You can load and save projects, retaining most of the temporary data during your workflow.': '可以加载和保存工程，保留大多工作时的临时数据。',
        'There is a tutorial.infcanvas file in the extension root directory as an example project.': '在插件的根目录有tutorial.infcanvas文件，作为一个示例工程。',
        '🔌 Plugins': '🔌 插件',
        'There are currently several Built-In plugins available.': '目前有一些Built-In插件可以使用。',
        'More plugin-related features may be implemented in the future.': '更多插件相关功能，有可能在后续进行实现。',
        'Edge Padding': '边缘扩展选项',
        'Black': '全黑',
        'White': '全白',
        'Extend Edge': '扩展边缘',
        'Edge Blur': '边缘模糊',
        'Hires Fix': '高分修复',
        'Upscaler': '放大算法',
        'Scale Factor': '放大倍数',
        'Tile Overlap': '切片重叠像素',
        'Tile Batch Size': '并行处理切片数 (Batch Size)',
        'Steps': '步数',
        'Denoising Strength': '重绘幅度',
        'Manual Prompt Review': '手动提示词审查',
        'Autosaving...': '自动保存中...',
        'Autosaved successfully!': '自动保存成功！',
        'Autosave Detected': '检测到自动保存',
        'A newer autosave exists for this project. Do you want to recover it?': '该工程存在更新的自动保存数据。是否恢复？',
        'No, load original': '否，加载原始数据',
        'Yes, recover': '是，恢复',
        'Save': '保存',
        'Loading projects...': '加载工程列表...',
        'Loading project...': '加载工程中...',
        'Auto Save': '自动保存',
        'Projects': '工程',
        'Processing...': '处理中...',
        'Dialog': '对话框',
        'Pipeline': '执行节点',
        'No projects found.': '未找到工程。',
        'Saving project...': '保存工程中...',
        'Project loaded successfully!': '工程加载成功！',
        'Project saved successfully!': '工程保存成功！',
        'Error: ': '错误：',
        'Existing Projects': '已有工程'
    };
    return dict[enStr] || enStr;
}

window.t = t;
window.__ic_i18n = t;

function translateGradio() {
    if (!isZh) return;
    const ids = ['ic_prev_btn', 'ic_now_btn', 'ic_reset_btn', 'ic_download_btn', 'ic_guide_btn', 'ic_clear_mask', 'ic_upload_image', 'ic_accordion_upload', 'ic_accordion_canvas', 'ic_accordion_gen', 'ic_accordion_project', 'ic_accordion_workflow', 'ic_tool_label', 'ic_tool', 'ic_show_overlay', 'ic_auto_scale', 'ic_edge_fix', 'ic_edge_fix_power', 'ic_latent_blend', 'ic_latent_blend_power', 'ic_tool_rect', 'ic_tool_brush', 'ic_tool_ellipse', 'ic_tool_eraser', 'ic_copy_btn', 'ic_show_overlay_btn', 'ic_auto_scale_btn', 'ic_save_project_btn', 'ic_load_project_btn', 'ic_project_name', 'ic_outpaint_pad'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                const text = node.nodeValue.trim();
                if (t(text) !== text) node.nodeValue = node.nodeValue.replace(text, t(text));
            }
        }
    });
}

// Run translation once immediately, then observe for future DOM changes
const icContainer = document.getElementById('ic-container');
if (icContainer) {
    translateGradio();
    const gradioObserver = new MutationObserver(() => {
        translateGradio();
    });
    gradioObserver.observe(icContainer, { childList: true, subtree: true });
} else {
    // Fallback: container not ready yet, retry after init
    setTimeout(() => {
        translateGradio();
        const container = document.getElementById('ic-container');
        if (container) {
            const gradioObserver = new MutationObserver(() => {
                translateGradio();
            });
            gradioObserver.observe(container, { childList: true, subtree: true });
        }
    }, 2000);
}

let ic_initInterval = setInterval(() => {
    const container = document.getElementById('ic-container');
    const lastElement = document.getElementById('ic_html_info');
    if (container && lastElement) {
        clearInterval(ic_initInterval);
        initInfiniteCanvas();
    }
}, 500);

function initInfiniteCanvas() {
