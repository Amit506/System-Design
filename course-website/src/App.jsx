import React, { useState, useMemo } from 'react';
import { Zap, BookOpen, ChevronRight, ArrowRight } from 'lucide-react';
import catalogData from './catalog.json';
import Sidebar from './Sidebar';
import CourseViewer from './CourseViewer';

function flattenNodes(nodes) {
  let flat = [];
  if (!nodes) return flat;
  for (const node of nodes) {
    flat.push(node);
    if (node.children && node.children.length > 0) {
      flat = flat.concat(flattenNodes(node.children));
    }
  }
  return flat;
}

function App() {
  const allDocs = useMemo(() => flattenNodes(catalogData.chapters), []);

  const [activeDoc, setActiveDoc] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const activeIndex = allDocs.findIndex(d => d.id === activeDoc?.id);
  const nextDoc = activeIndex >= 0 ? allDocs[activeIndex + 1] || null : null;

  return (
    <div className="app-shell dark-theme">
      <nav className="top-nav glass-nav">
        <div className="top-nav-brand">
          <div className="brand-icon"><Zap size={18} strokeWidth={2.5} /></div>
          <span className="brand-name">System <span className="brand-accent">Design</span></span>
          <span className="brand-tag glow-tag">PRO</span>
        </div>

        <div className="top-nav-sep" />

        {activeDoc && (
          <div className="top-nav-breadcrumb slide-in">
            <span className="crumb-section">Course</span>
            <ChevronRight size={14} style={{ color: 'var(--txt-4)', flexShrink: 0 }} />
            <span className="crumb-title">{activeDoc.title}</span>
          </div>
        )}

        <div className="top-nav-right">
          {nextDoc && (
            <button className="btn-next pulse-hover" onClick={() => setActiveDoc(nextDoc)}>
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </nav>

      <div className="app-body">
        <Sidebar
          catalog={catalogData}
          activeDoc={activeDoc}
          setActiveDoc={setActiveDoc}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
        <CourseViewer activeDoc={activeDoc} />
      </div>
    </div>
  );
}

export default App;
