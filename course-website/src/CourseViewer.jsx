import React from 'react';
import { Layers, Lightbulb, GitMerge, AlertTriangle, CheckCircle, Target, Database, FileText, XOctagon } from 'lucide-react';
import MermaidRenderer from './MermaidRenderer';

function SectionCard({ title, icon: Icon, children, className = '' }) {
    return (
        <div className={`info-card ${className} slide-up`}>
            <div className="info-card-header">
                {Icon && <div className="icon-wrapper"><Icon size={18} /></div>}
                <h4>{title}</h4>
            </div>
            <div className="info-card-body">
                {children}
            </div>
        </div>
    );
}

export default function CourseViewer({ activeDoc }) {
    if (!activeDoc) {
        return (
            <main className="main-content flex-center gradient-bg">
                <div className="welcome-screen zoom-in">
                    <div className="welcome-icon-wrap glass-circle">
                        <Layers size={64} strokeWidth={1.5} className="text-gold animate-float" />
                    </div>
                    <h2 className="title-gradient text-4xl font-extrabold mt-6">System Design Masterclass</h2>
                    <p className="text-lg text-muted mt-4 max-w-lg">
                        Select an extensive module from the sidebar. Deep dive into distributed architecture, internals, trade-offs, and algorithms.
                    </p>
                </div>
            </main>
        );
    }

    const { explanation, tags, summary, diagram, configurable_params, advanced_tweaks, common_mistakes, tradeoffs, limitations, interview_tips, references } = activeDoc;

    return (
        <main className="main-content styled-scroll">
            <div className="content-area">
                <div className="lesson-header fade-in">
                    <div className="lesson-badges">
                        {tags?.map(tag => (
                            <span key={tag} className="tag-badge">#{tag}</span>
                        ))}
                    </div>
                    <h1 className="lesson-title font-display text-gradient">{activeDoc.title}</h1>
                    {summary && <p className="lesson-summary text-xl lead-text mt-4">{summary}</p>}
                </div>

                <div className="json-content mt-8 stagger-fade-in">
                    {explanation?.overview && (
                        <div className="overview-section glass-panel p-6 rounded-xl mb-8 border-gold-subtle">
                            <p className="text-lg leading-relaxed">{explanation.overview}</p>
                        </div>
                    )}

                    {explanation?.how_it_works_internally && (
                        <SectionCard title="How It Works Internally" icon={Database} className="glow-on-hover mt-8">
                            <p className="leading-relaxed">{explanation.how_it_works_internally}</p>
                        </SectionCard>
                    )}

                    {diagram && diagram.type === 'mermaid' && (
                        <div className="diagram-section my-12">
                            <h3 className="section-title flex items-center gap-2"><Layers size={20} className="text-gold" /> Architecture Diagram</h3>
                            {diagram.description && <p className="text-muted mb-4">{diagram.description}</p>}
                            <div className="diagram-wrapper glass-panel p-2 rounded-xl border-subtle relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2"><span className="text-xs font-mono text-muted bg-dark rounded px-2">MERMAID (LIVE)</span></div>
                                <MermaidRenderer chart={diagram.data?.mermaid_source || diagram.data} />
                            </div>
                        </div>
                    )}

                    {diagram && diagram.type === 'excalidraw' && (
                        <div className="diagram-section my-12">
                            <h3 className="section-title flex items-center gap-2"><Layers size={20} className="text-gold" /> Visual Architecture</h3>
                            {diagram.description && <p className="text-muted mb-4">{diagram.description}</p>}
                            <div className="diagram-wrapper glass-panel p-10 text-center rounded-xl border-2 border-dashed border-gold/30 flex flex-col items-center justify-center min-h-[260px] bg-gold/5">
                                <div className="bg-dark/80 p-4 rounded-full mb-4 border border-gold/20">
                                    <Layers size={40} className="text-gold animate-pulse" />
                                </div>
                                <h4 className="text-lg font-bold text-gold mb-1">{diagram.title}</h4>
                                <span className="text-sm font-medium text-muted mb-4 px-6 max-w-md">The high-fidelity Excalidraw version of this diagram is currently being rendered.</span>
                                <div className="flex items-center gap-2 px-3 py-1 bg-gold/10 rounded-full border border-gold/20">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Renderer Pending</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {explanation?.step_by_step && (
                        <div className="steps-section my-12">
                            <h3 className="section-title mb-6">Execution Flow</h3>
                            <div className="steps-timeline relative pl-6 border-l-2 border-gold-dark">
                                {explanation.step_by_step.map((step, idx) => (
                                    <div key={idx} className="timeline-item mb-8 relative">
                                        <div className="timeline-marker absolute -left-[35px] bg-dark text-gold border-2 border-gold w-[26px] h-[26px] rounded-full flex-center font-bold text-xs shadow-glow">
                                            {step.step}
                                        </div>
                                        <div className="timeline-content bg-panel rounded-lg p-5 border border-subtle hover:border-gold transition-colors">
                                            <h4 className="text-lg font-bold text-light mb-2">{step.title}</h4>
                                            <p className="text-muted leading-relaxed">{step.detail}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {explanation?.key_concepts && (
                        <div className="concepts-section my-12">
                            <h3 className="section-title mb-6">Key Concepts</h3>
                            <div className="concepts-grid grid gap-6 md:grid-cols-2">
                                {explanation.key_concepts.map((concept, idx) => (
                                    <div key={idx} className="concept-card bg-panel p-5 rounded-xl border border-subtle shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                        <h4 className="text-lg font-bold text-indigo-100 mb-2">{concept.term}</h4>
                                        <p className="text-sm text-muted leading-relaxed">{concept.definition}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {explanation?.examples && (
                        <div className="examples-section my-12">
                            <h3 className="section-title mb-6 flex items-center gap-2"><FileText size={20} className="text-gold" /> Code Examples & Use Cases</h3>
                            <div className="examples-grid grid gap-6">
                                {explanation.examples.map((ex, idx) => (
                                    <div key={idx} className="example-card bg-dark/60 border border-subtle rounded-xl overflow-hidden">
                                        <div className="example-header bg-panel p-4 border-b border-subtle">
                                            <h4 className="font-bold text-light text-lg">{ex.title}</h4>
                                            {ex.description && <p className="text-sm text-muted mt-1">{ex.description}</p>}
                                        </div>
                                        {ex.code && (
                                            <div className="example-code p-4 overflow-x-auto">
                                                <pre className="text-sm font-mono text-cyan-300"><code>{ex.code}</code></pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="split-grid grid gap-8 md:grid-cols-2 my-10">
                        {tradeoffs && tradeoffs.length > 0 && (
                            <SectionCard title="Technical Trade-offs" icon={GitMerge} className="tradeoffs-card">
                                <ul className="premium-list tradeoff-list">
                                    {tradeoffs.map((item, i) => <li key={i}><span className="bullet">⚖️</span>{item}</li>)}
                                </ul>
                            </SectionCard>
                        )}
                        {common_mistakes && common_mistakes.length > 0 && (
                            <SectionCard title="Common Anti-patterns" icon={AlertTriangle} className="mistakes-card border-red-subtle">
                                <ul className="premium-list warning-list">
                                    {common_mistakes.map((item, i) => <li key={i}><AlertTriangle size={14} className="text-red-400 mr-2 flex-shrink-0 mt-1" /><span>{item}</span></li>)}
                                </ul>
                            </SectionCard>
                        )}
                    </div>
                    
                    {limitations && limitations.length > 0 && (
                        <SectionCard title="System Limitations & Hard Truths" icon={XOctagon} className="limitations-card my-10 border-orange-subtle bg-gradient-to-br from-panel to-orange-900/10">
                            <ul className="premium-list space-y-3">
                                {limitations.map((item, i) => (
                                    <li key={i} className="flex font-medium items-start p-3 bg-dark/40 rounded-lg">
                                        <XOctagon size={16} className="text-orange-400 mr-3 flex-shrink-0 mt-0.5" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </SectionCard>
                    )}

                    {configurable_params && configurable_params.length > 0 && (
                        <SectionCard title="Production Tuning" icon={Lightbulb} className="my-10">
                            <div className="table-responsive rounded-lg overflow-hidden border border-subtle">
                                <table className="w-full text-left text-sm text-muted">
                                    <thead className="text-xs uppercase bg-dark text-light border-b border-subtle">
                                        <tr>
                                            <th className="px-6 py-4 font-bold">Parameter</th>
                                            <th className="px-6 py-4 font-bold">Default</th>
                                            <th className="px-6 py-4 font-bold">Effect & Trade-offs</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-subtle">
                                        {configurable_params.map((param, i) => (
                                            <tr key={i} className="bg-panel hover:bg-hover transition-colors">
                                                <td className="px-6 py-4 font-mono text-cyan-400">{param.name}</td>
                                                <td className="px-6 py-4"><span className="bg-dark px-2 py-1 rounded-md text-xs">{param.default}</span></td>
                                                <td className="px-6 py-4 leading-relaxed">
                                                    <div className="mb-2"><span className="text-light font-semibold">Effect:</span> {param.effect}</div>
                                                    <div><span className="text-gold-light font-semibold">Trade-off:</span> {param.tradeoff}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    )}

                    {advanced_tweaks && advanced_tweaks.length > 0 && (
                        <SectionCard title="Advanced Tweaks" icon={Target} className="my-10 border-indigo-subtle">
                            <div className="tweaks-grid grid gap-4">
                                {advanced_tweaks.map((tweak, i) => (
                                    <div key={i} className="tweak-row flex flex-col md:flex-row gap-4 p-4 rounded-lg bg-dark/50 border border-subtle/50 hover:bg-dark transition-colors">
                                        <div className="tweak-left md:w-1/3 border-b md:border-b-0 md:border-r border-subtle pb-3 md:pb-0 md:pr-4">
                                            <h5 className="font-bold text-indigo-300 text-md mb-1">{tweak.technique}</h5>
                                            <span className="text-xs uppercase tracking-wider text-muted font-bold">When to use: <span className="text-light normal-case font-normal ml-1">{tweak.when_to_use}</span></span>
                                        </div>
                                        <div className="tweak-right md:w-2/3">
                                            <p className="text-sm leading-relaxed">{tweak.how}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}

                    {interview_tips && interview_tips.length > 0 && (
                        <SectionCard title="Interview Playbook" icon={CheckCircle} className="my-10 border-green-subtle bg-gradient-to-br from-panel to-green-900/10">
                            <ul className="premium-list success-list space-y-3">
                                {interview_tips.map((item, i) => (
                                    <li key={i} className="flex font-medium items-start p-3 bg-dark/40 rounded-lg">
                                        <CheckCircle size={16} className="text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </SectionCard>
                    )}

                    {references && references.length > 0 && (
                        <div className="references-section my-16 pt-8 border-t border-subtle">
                            <h3 className="text-sm uppercase tracking-widest text-muted font-bold mb-6 text-center">Further Reading & References</h3>
                            <div className="reference-links flex flex-wrap justify-center gap-4">
                                {references.map((ref, i) => (
                                    <a key={i} href={ref.url} target="_blank" rel="noreferrer" className="ref-badge flex items-center gap-2 px-4 py-2 rounded-full bg-dark border border-subtle hover:border-gold hover:text-gold transition-all text-sm group">
                                        <FileText size={14} className="group-hover:text-gold text-muted" />
                                        <span className="truncate max-w-[200px]">{ref.title}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
