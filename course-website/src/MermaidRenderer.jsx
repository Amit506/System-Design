import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { GitBranch } from 'lucide-react';

// Initialize once at module level, not inside component
mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    fontFamily: "'Inter', -apple-system, sans-serif",
    fontSize: 14,
    flowchart: {
        useMaxWidth: true,
        htmlLabels: false, // Use SVG labels — avoids foreignObject color issues
        padding: 24,
        curve: 'basis',
    },
    sequence: { useMaxWidth: true },
    er: { useMaxWidth: true },
    themeVariables: {
        // ── Canvas ──────────────────────
        background: '#0f1724',
        mainBkg: '#1c2746',

        // ── Primary nodes (gold border) ──
        primaryColor: '#1c2746',
        primaryBorderColor: '#f0b429',
        primaryTextColor: '#ffffff',

        // ── Secondary nodes (indigo) ──
        secondaryColor: '#12192e',
        secondaryBorderColor: '#818cf8',
        secondaryTextColor: '#e6edf3',

        // ── Tertiary nodes (cyan) ──
        tertiaryColor: '#0b1929',
        tertiaryBorderColor: '#38bdf8',
        tertiaryTextColor: '#e6edf3',

        // ── Edges ──────────────────────
        lineColor: '#8b949e',
        edgeLabelBackground: '#0f1724',

        // ── Global text ────────────────
        textColor: '#e6edf3',
        labelColor: '#e6edf3',
        labelFontColor: '#e6edf3',
        labelBackground: '#0f1724',

        // ── Clusters ───────────────────
        clusterBkg: 'rgba(28,39,70,0.7)',
        clusterBorder: '#2d3a5c',
        titleColor: '#f0b429',

        // ── Sequence diagrams ──────────
        actorBkg: '#1c2746',
        actorBorder: '#f0b429',
        actorTextColor: '#ffffff',
        actorLineColor: '#3d4a6b',
        signalColor: '#f0b429',
        signalTextColor: '#ffffff',
        labelBoxBkgColor: '#0f1724',
        labelBoxBorderColor: '#2d3a5c',
        labelTextColor: '#e6edf3',
        loopTextColor: '#e6edf3',
        activationBorderColor: '#818cf8',
        activationBkgColor: 'rgba(129,140,248,0.15)',
        sequenceNumberColor: '#1c2746',

        // ── ER diagrams ────────────────
        attributeBackgroundColorEven: '#1a2540',
        attributeBackgroundColorOdd: '#1c2746',
        entityLabelColor: '#ffffff',
        entityBorder: '#f0b429',

        // ── Pie ────────────────────────
        pie1: '#f0b429', pie2: '#818cf8', pie3: '#38bdf8',
        pie4: '#4ade80', pie5: '#fb923c', pie6: '#f472b6',
        pie7: '#a78bfa', pie8: '#34d399',
        pieTextColor: '#ffffff',
        pieOuterStrokeColor: '#2d3a5c',
        pieSectionTextColor: '#ffffff',

        // ── Notes ──────────────────────
        noteBkgColor: '#1c2746',
        noteTextColor: '#e6edf3',
        noteBorderColor: '#f0b429',
    }
});

let renderSeq = 0;

export default function MermaidRenderer({ chart }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current || !chart?.trim()) return;

        renderSeq += 1;
        const id = `mermaid-${Date.now()}-${renderSeq}`;
        const node = containerRef.current;

        // Clear previous
        node.innerHTML = '<div style="color:var(--txt-3);font-size:12px;padding:12px;">Rendering diagram…</div>';

        mermaid.render(id, chart.trim())
            .then(({ svg }) => {
                if (!node) return;
                node.innerHTML = svg;

                const svgEl = node.querySelector('svg');
                if (!svgEl) return;

                // Make responsive
                svgEl.removeAttribute('height');
                svgEl.style.width = '100%';
                svgEl.style.maxWidth = '100%';
                svgEl.style.height = 'auto';
                svgEl.style.overflow = 'visible';

                // Force all SVG text to be visible
                svgEl.querySelectorAll('text, tspan').forEach(el => {
                    const current = el.getAttribute('fill');
                    if (!current || current === '#000' || current === '#000000' || current === 'black' || current === 'rgb(0,0,0)') {
                        el.setAttribute('fill', '#e6edf3');
                    }
                });

                // Fix any span/foreignObject text color (if htmlLabels somehow on)
                svgEl.querySelectorAll('foreignObject [style]').forEach(el => {
                    if (el.style.color && (el.style.color === 'black' || el.style.color === '#000')) {
                        el.style.color = '#e6edf3';
                    }
                });
            })
            .catch((err) => {
                if (node) {
                    // Show the raw code cleanly styled as a fallback
                    const escaped = chart.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    node.innerHTML = `
            <details style="padding:16px;">
              <summary style="color:var(--gold-500);font-size:13px;cursor:pointer;font-family:var(--ff-heading);font-weight:600;">
                ⚠ Diagram could not render — click to view source
              </summary>
              <pre style="margin-top:12px;color:#818cf8;font-size:12px;font-family:'JetBrains Mono',monospace;white-space:pre-wrap;overflow-x:auto;line-height:1.6;">${escaped}</pre>
            </details>
          `;
                }
            });
    }, [chart]);

    return (
        <div className="mermaid-wrapper">
            <div className="mermaid-header">
                <GitBranch size={13} />
                Architecture Diagram
            </div>
            <div className="mermaid-container" ref={containerRef} />
        </div>
    );
}
