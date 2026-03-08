import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Layers, Clock, BookOpen } from 'lucide-react';
import MermaidRenderer from './MermaidRenderer';

// Strip leading emoji from heading text
const EMOJI_RE = /^[\p{Emoji}\p{Emoji_Presentation}\u200d\ufe0f\s]+/u;
function stripLeadingEmoji(str) {
    if (typeof str !== 'string') return str;
    return str.replace(EMOJI_RE, '').trim();
}

// Recursively extract plain text from React children and strip emoji
function cleanChildren(children) {
    if (typeof children === 'string') return stripLeadingEmoji(children);
    if (Array.isArray(children)) {
        const cleaned = children.map(child =>
            typeof child === 'string' ? stripLeadingEmoji(child) : child
        );
        return cleaned;
    }
    return children;
}

const codeTheme = {
    ...oneDark,
    'pre[class*="language-"]': {
        ...oneDark['pre[class*="language-"]'],
        background: '#0d1117',
        margin: 0,
        borderRadius: 0,
        padding: '20px',
        fontSize: '13px',
        lineHeight: '1.7',
    },
    'code[class*="language-"]': {
        ...oneDark['code[class*="language-"]'],
        background: '#0d1117',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    }
};

function CodeBlock({ language, code }) {
    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <div className="code-dots"><span /><span /><span /></div>
                <span className="code-lang-tag">{language || 'code'}</span>
            </div>
            <SyntaxHighlighter
                style={codeTheme}
                language={language || 'text'}
                PreTag="div"
                customStyle={{ margin: 0, borderRadius: 0 }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
}

const mdComponents = {
    // Demote h1 from content and strip emoji from all headings
    h1: ({ children }) => <h2>{cleanChildren(children)}</h2>,
    h2: ({ children }) => <h2>{cleanChildren(children)}</h2>,
    h3: ({ children }) => <h3>{cleanChildren(children)}</h3>,
    h4: ({ children }) => <h4>{cleanChildren(children)}</h4>,
    h5: ({ children }) => <h5>{cleanChildren(children)}</h5>,
    h6: ({ children }) => <h6>{cleanChildren(children)}</h6>,

    code({ node, inline, className, children, ...props }) {
        const lang = /language-(\w+)/.exec(className || '')?.[1];
        const codeText = String(children).replace(/\n$/, '');

        if (!inline && lang === 'mermaid') {
            return <MermaidRenderer chart={codeText} />;
        }
        if (!inline && lang) {
            return <CodeBlock language={lang} code={codeText} />;
        }
        return <code className={className} {...props}>{children}</code>;
    },

    table: ({ children }) => (
        <div style={{ overflowX: 'auto', margin: '32px 0' }}>
            <table style={{ margin: 0 }}>{children}</table>
        </div>
    ),

    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
};

export default function CourseViewer({ activeDoc, section, readingTime }) {
    if (!activeDoc) {
        return (
            <main className="main-content">
                <div className="welcome-screen">
                    <div className="welcome-icon-wrap">
                        <Layers size={48} strokeWidth={1.2} style={{ color: 'var(--gold-500)' }} />
                    </div>
                    <h2>Welcome to System Design Pro</h2>
                    <p>Select a module from the sidebar to begin. Start with Fundamentals or jump straight into a real-world Architecture case study.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="main-content">
            <div className="content-area">
                <div className="lesson-header">
                    <div className="lesson-category-tag">
                        {section === 'Fundamentals'
                            ? <Layers size={11} />
                            : <BookOpen size={11} />
                        }
                        {section}
                    </div>
                    <h1 className="lesson-title">{activeDoc.title}</h1>
                    <div className="lesson-meta">
                        <span className="lesson-meta-item">
                            <Clock size={12} /> {readingTime} min read
                        </span>
                        <span className="lesson-meta-item" style={{ color: 'var(--txt-4)' }}>· Deep Dive</span>
                    </div>
                </div>

                <ReactMarkdown
                    className="md-content"
                    remarkPlugins={[remarkGfm]}
                    components={mdComponents}
                >
                    {activeDoc.content}
                </ReactMarkdown>
            </div>
        </main>
    );
}
