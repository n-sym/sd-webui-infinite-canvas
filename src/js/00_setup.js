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
        'Canvas ⏪': '画布 ⏪',
        'Canvas ⏩': '画布 ⏩',
        'Mask ⏪': '蒙版 ⏪',
        'Mask ⏩': '蒙版 ⏩',
        'Reset Canvas': '重置画布',
        'Download Canvas': '下载画布',
        'Clear Mask': '清除蒙版',
        'Upload Base Image': '上传底图',
        'Canvas & Mask Parameters': '画布与蒙版参数',
        'Project Management': '工程管理',
        'Project Name': '工程名称',
        'Save Project': '保存工程',
        'Load Project': '读取工程',
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
        '📖 Guide': '📖 操作指南',
        '📖 Infinite Canvas Guide': '📖 无边画布使用指南',
        '👆 Basics & Navigation': '👆 基础操作与导航',
        'Pan Canvas': '平移画布',
        'Pan Canvas Desc': '在蓝框外部按住 <kbd>Alt</kbd> + 左键拖拽 (或鼠标中键拖拽) 以平移整个画布。',
        'Zoom': '缩放画布',
        'Zoom Desc': '使用鼠标滚轮进行放大和缩小。',
        '🟦 The Generation Area (Blue Box)': '🟦 生成区域 (蓝框)',
        'Move Box': '移动蓝框',
        'Move Box Desc': '在蓝框内部按住 <kbd>Alt</kbd> + 左键拖拽 (或鼠标中键拖拽) 即可移动蓝框。',
        'Rotate Box': '旋转蓝框',
        'Rotate Box Desc': '在任何位置按住 <kbd>Shift</kbd> + 左键拖拽，即可自由旋转蓝框。当角度接近水平或垂直时会自动吸附正位！',
        '🖌️ Drawing Masks': '🖌️ 绘制蒙版',
        'Draw Mask Desc 1': '直接使用鼠标左键在任意位置拖拽，即可绘制蒙版。',
        'Draw Mask Desc 2': '当你旋转蓝框后，你的画笔和矩形框仍会保持与屏幕水平，底层会自动帮你逆向映射！',
        '🔄 Undo/Redo & Generation': '🔄 撤销重做与生成',
        'Undo Desc 1': '生成完成后，会弹出预览确认框，你可以在应用前调整边缘羽化。',
        'Undo Desc 2': '你可以随时使用工具栏的 <strong>撤销 / 重做</strong> 按钮来回退你的操作。',
        'Edge Padding': '边缘扩展选项',
        'Black': '全黑',
        'White': '全白',
        'Extend Edge': '扩展边缘',
        'Edge Blur': '边缘模糊'
    };
    return dict[enStr] || enStr;
}

document.addEventListener("DOMContentLoaded", function() {
    setInterval(translateGradio, 1000);
    
    function translateGradio() {
        if (!isZh) return;
        const ids = ['ic_prev_btn', 'ic_now_btn', 'ic_reset_btn', 'ic_download_btn', 'ic_guide_btn', 'ic_clear_mask', 'ic_upload_image', 'ic_accordion_upload', 'ic_accordion_canvas', 'ic_accordion_gen', 'ic_accordion_project', 'ic_tool_label', 'ic_tool', 'ic_show_overlay', 'ic_auto_scale', 'ic_edge_fix', 'ic_edge_fix_power', 'ic_latent_blend', 'ic_latent_blend_power', 'ic_tool_rect', 'ic_tool_brush', 'ic_tool_ellipse', 'ic_tool_eraser', 'ic_copy_btn', 'ic_show_overlay_btn', 'ic_auto_scale_btn', 'ic_save_project_btn', 'ic_load_project_btn', 'ic_project_name', 'ic_outpaint_pad'];
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

    let initInterval = setInterval(() => {
        const container = document.getElementById('ic-container');
        const lastElement = document.getElementById('ic_html_info');
        if (container && lastElement) {
            clearInterval(initInterval);
            initInfiniteCanvas();
        }
    }, 500);
});

function initInfiniteCanvas() {
