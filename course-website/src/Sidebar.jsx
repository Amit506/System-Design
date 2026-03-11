import React, { useState, useMemo } from 'react';
import { Search, Compass, ChevronRight, ChevronDown, BookOpen } from 'lucide-react';

export default function Sidebar({ catalog, activeDoc, setActiveDoc, searchQuery, setSearchQuery }) {
    const { chapters } = catalog;

    const filter = (list) => {
        if (!searchQuery) return list || [];
        const q = searchQuery.toLowerCase();
        const filterNodes = (nodes) => {
            if (!nodes) return [];
            return nodes.map(node => {
                const matchMe = node.title?.toLowerCase().includes(q) || node.summary?.toLowerCase().includes(q) || (node.tags && node.tags.some(t => t.toLowerCase().includes(q)));
                const childrenMatch = filterNodes(node.children);
                if (matchMe || childrenMatch.length > 0) {
                    return { ...node, children: childrenMatch };
                }
                return null;
            }).filter(Boolean);
        };
        return filterNodes(list);
    };

    const filteredChapters = useMemo(() => filter(chapters), [chapters, searchQuery]);
    const [expanded, setExpanded] = useState({});

    const toggleExpand = (id, e) => {
        e.stopPropagation();
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const renderTree = (nodes, depth = 0) => {
        return nodes.map((node) => {
            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = expanded[node.id] || searchQuery.length > 0;
            const isActive = activeDoc?.id === node.id;

            return (
                <div key={node.id} className="nav-tree-item">
                    <div
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        style={{ paddingLeft: `${16 + depth * 16}px` }}
                        onClick={() => setActiveDoc(node)}
                    >
                        {hasChildren ? (
                            <div className="expand-icon" onClick={(e) => toggleExpand(node.id, e)}>
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                        ) : (
                            <div className="expand-spacer" />
                        )}
                        <span className="nav-item-num">{node.order ? `${node.order}. ` : ''}</span>
                        <span className="nav-item-label">{node.title}</span>
                    </div>
                    {hasChildren && isExpanded && (
                        <div className="nav-children slide-down">
                            {renderTree(node.children, depth + 1)}
                        </div>
                    )}
                </div>
            );
        });
    };

    return (
        <aside className="sidebar premium-sidebar">
            <div className="sidebar-search">
                <div className="search-input-wrap shadow-inner">
                    <Search size={14} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search modules, tags..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="sidebar-content">
                <div className="sidebar-section">
                    <div className="sidebar-section-header">
                        <Compass size={14} className="section-icon text-gold" />
                        <span className="text-gradient">Course Contents</span>
                    </div>
                    {filteredChapters && filteredChapters.length > 0 ? renderTree(filteredChapters) : (
                        <div className="empty-state">
                            <BookOpen size={24} className="text-muted mb-2" />
                            No results for "{searchQuery}"
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
