// 10_dev.js

document.addEventListener("keydown", (e) => {
    // Press ESC to toggle Developer Panel
    if (e.key === "Escape") {
        const devPanel = document.getElementById('ic-dev-panel');
        if (devPanel) {
            devPanel.style.display = devPanel.style.display === 'none' ? 'flex' : 'none';
        } else {
            createDevPanel();
        }
    }
});

function createDevPanel() {
    const container = document.getElementById('ic-container');
    if (!container) return;

    const panel = document.createElement('div');
    panel.id = 'ic-dev-panel';
    panel.className = 'fluent-panel';
    panel.style.position = 'absolute';
    panel.style.top = '50%';
    panel.style.left = '50%';
    panel.style.transform = 'translate(-50%, -50%)';
    panel.style.width = '280px';
    panel.style.background = 'color-mix(in srgb, color-mix(in srgb, var(--body-background-fill, #1e1e1e) 95%, #000) 85%, transparent)';
    panel.style.backdropFilter = 'blur(12px)';
    panel.style.WebkitBackdropFilter = 'blur(12px)';
    panel.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    panel.style.borderRadius = '16px';
    panel.style.padding = '20px';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '12px';
    panel.style.zIndex = '9999';
    panel.style.color = 'var(--body-text-color, #fff)';
    panel.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
    panel.style.fontFamily = 'sans-serif';

    const title = document.createElement('h3');
    title.innerText = 'Developer Panel';
    title.style.margin = '0 0 8px 0';
    title.style.textAlign = 'center';
    title.style.fontSize = '16px';
    title.style.fontWeight = '600';
    panel.appendChild(title);

    const btnStyle = `
        padding: 10px 16px;
        background: rgba(255, 255, 255, 0.1);
        color: var(--body-text-color, #fff);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.2s ease;
    `;

    const createBtn = (text, onClick) => {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.cssText = btnStyle;
        btn.onmouseover = () => {
            btn.style.background = 'cornflowerblue';
            btn.style.borderColor = 'cornflowerblue';
            btn.style.color = '#fff';
        };
        btn.onmouseout = () => {
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            btn.style.color = 'var(--body-text-color, #fff)';
        };
        btn.addEventListener('click', async () => {
            const originalText = btn.innerText;
            btn.innerText = 'Working...';
            await onClick();
            btn.innerText = originalText;
        });
        return btn;
    };

    const rebuildBtn = createBtn('Rebuild JS', async () => {
        try {
            const res = await fetch('/infinite-canvas-api/dev/rebuild-js', { method: 'POST' });
            const data = await res.json();
            alert(data.status === 'success' ? data.message : 'Error: ' + data.error);
        } catch (e) {
            alert('Failed: ' + e);
        }
    });
    panel.appendChild(rebuildBtn);

    const reloadBtn = createBtn('Reload Python', async () => {
        try {
            const res = await fetch('/infinite-canvas-api/dev/reload-python', { method: 'POST' });
            const data = await res.json();
            alert(data.status === 'success' ? data.message : 'Error: ' + data.error);
        } catch (e) {
            alert('Failed: ' + e);
        }
    });
    panel.appendChild(reloadBtn);

    const graphBtn = createBtn('Dependency Graph', async () => {
        try {
            if (!window.mermaid) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js';
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('Failed to load mermaid.min.js from CDN. Please check your network connection.'));
                    document.head.appendChild(script);
                });
                mermaid.initialize({ startOnLoad: false, theme: 'dark' });
            }

            const res = await fetch('/infinite-canvas-api/workflow');
            const data = await res.json();
            const registry = data.registry || [];

            const resolveTypeName = (t) => {
                if (!t) return "Unknown";
                if (typeof t === 'string') return t;
                if (t.mapping) return t.target ? t.target.type : "Unknown";
                return t.type || "Unknown";
            };

            let graphStr = "graph TD\n";
            let dataNodes = new Set();
            
            registry.forEach(step => {
                graphStr += `  step_${step.id}["${step.name}"]\n`;
                if (step.type_signature) {
                    (step.type_signature.in || []).forEach(t => dataNodes.add(resolveTypeName(t)));
                    (step.type_signature.out || []).forEach(t => dataNodes.add(resolveTypeName(t)));
                }
            });
            
            dataNodes.forEach(t => {
                graphStr += `  data_${t}(("${t}"))\n`;
                graphStr += `  style data_${t} fill:#2d3748,stroke:#4a5568,stroke-width:2px,color:#fff\n`;
            });
            
            registry.forEach(step => {
                if (step.type_signature) {
                    (step.type_signature.in || []).forEach(t => {
                        graphStr += `  data_${resolveTypeName(t)} --> step_${step.id}\n`;
                    });
                    (step.type_signature.out || []).forEach(t => {
                        graphStr += `  step_${step.id} --> data_${resolveTypeName(t)}\n`;
                    });
                }
            });

            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Pipeline Dependency Graph</title>
    <style>
        body {
            background-color: #1e1e1e;
            color: #fff;
            font-family: sans-serif;
            margin: 0;
            padding: 40px;
            display: flex;
            justify-content: center;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"><\/script>
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            mermaid.initialize({ startOnLoad: true, theme: 'dark' });
        });
    <\/script>
</head>
<body>
    <div class="mermaid">
${graphStr}
    </div>
</body>
</html>
            `;

            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(htmlContent);
                newWindow.document.close();
            } else {
                alert('Popup blocked. Please allow popups for this site to view the graph.');
            }

        } catch (e) {
            alert('Dependency Graph Error: ' + e.message);
        }
    });
    panel.appendChild(graphBtn);



    const closeBtn = document.createElement('button');
    closeBtn.innerText = 'Close';
    closeBtn.style.cssText = `
        margin-top: 4px;
        padding: 8px;
        background: transparent;
        color: rgba(255, 255, 255, 0.6);
        border: none;
        cursor: pointer;
        font-size: 13px;
        transition: color 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
    closeBtn.onmouseout = () => closeBtn.style.color = 'rgba(255, 255, 255, 0.6)';
    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
    });
    panel.appendChild(closeBtn);

    container.appendChild(panel);
}
