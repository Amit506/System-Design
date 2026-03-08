import React, { useState, useMemo } from 'react';
import { Zap, BookOpen, ChevronRight, ArrowRight } from 'lucide-react';
import catalogData from './catalog.json';
import Sidebar from './Sidebar';
import CourseViewer from './CourseViewer';

function estimateReadingTime(content = '') {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 220));
}

function App() {
  const allDocs = useMemo(() => [
    ...catalogData.fundamentals,
    ...catalogData.architectures,
  ], []);

  const [activeDoc, setActiveDoc] = useState(catalogData.fundamentals[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const activeIndex = allDocs.findIndex(d => d.id === activeDoc?.id);
  const nextDoc = allDocs[activeIndex + 1] || null;

  const readingTime = useMemo(
    () => estimateReadingTime(activeDoc?.content),
    [activeDoc]
  );

  const section = activeDoc
    ? catalogData.fundamentals.find(d => d.id === activeDoc.id)
      ? 'Fundamentals'
      : 'Architectures'
    : '';

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <div className="top-nav-brand">
          <div className="brand-icon"><Zap size={16} strokeWidth={2.5} /></div>
          <span className="brand-name">System <span className="brand-accent">Design</span></span>
          <span className="brand-tag">PRO</span>
        </div>

        <div className="top-nav-sep" />

        {activeDoc && (
          <div className="top-nav-breadcrumb">
            <span className="crumb-section">{section}</span>
            <ChevronRight size={14} style={{ color: 'var(--txt-4)', flexShrink: 0 }} />
            <span className="crumb-title">{activeDoc.title}</span>
          </div>
        )}

        <div className="top-nav-right">
          {activeDoc && (
            <div className="reading-time-badge">
              <BookOpen size={12} />
              {readingTime} min read
            </div>
          )}
          {nextDoc && (
            <button className="btn-next" onClick={() => setActiveDoc(nextDoc)}>
              Next <ArrowRight size={13} />
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
        <CourseViewer
          activeDoc={activeDoc}
          section={section}
          readingTime={readingTime}
        />
      </div>
    </div>
  );
}

export default App;
