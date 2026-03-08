import React, { useMemo } from 'react';
import { Search, Compass, Building2 } from 'lucide-react';

export default function Sidebar({ catalog, activeDoc, setActiveDoc, searchQuery, setSearchQuery }) {
    const { fundamentals, architectures } = catalog;

    const filter = (list) => {
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(d => d.title.toLowerCase().includes(q));
    };

    const filteredFundamentals = useMemo(() => filter(fundamentals), [fundamentals, searchQuery]);
    const filteredArchitectures = useMemo(() => filter(architectures), [architectures, searchQuery]);

    const renderItems = (list, offset = 0) =>
        list.map((doc, i) => (
            <div
                key={doc.id}
                className={`nav-item ${activeDoc?.id === doc.id ? 'active' : ''}`}
                onClick={() => setActiveDoc(doc)}
            >
                <span className="nav-item-num">{String(offset + i + 1).padStart(2, '0')}</span>
                <span className="nav-item-label">{doc.title}</span>
            </div>
        ));

    return (
        <aside className="sidebar">
            <div className="sidebar-search">
                <div className="search-input-wrap">
                    <Search size={13} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search modules..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="sidebar-content">
                <div className="sidebar-section">
                    <div className="sidebar-section-header">
                        <Compass size={12} className="section-icon" />
                        Fundamentals
                        <span style={{ marginLeft: 'auto', color: 'var(--txt-4)', fontSize: '11px' }}>
                            {filteredFundamentals.length}
                        </span>
                    </div>
                    {renderItems(filteredFundamentals, 0)}
                </div>

                {(filteredFundamentals.length > 0 && filteredArchitectures.length > 0) && (
                    <div className="sidebar-section-divider" />
                )}

                <div className="sidebar-section">
                    <div className="sidebar-section-header">
                        <Building2 size={12} className="section-icon" />
                        Architecture Case Studies
                        <span style={{ marginLeft: 'auto', color: 'var(--txt-4)', fontSize: '11px' }}>
                            {filteredArchitectures.length}
                        </span>
                    </div>
                    {renderItems(filteredArchitectures, fundamentals.length)}
                </div>

                {(filteredFundamentals.length === 0 && filteredArchitectures.length === 0) && (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--txt-4)', fontSize: '13px' }}>
                        No results for "{searchQuery}"
                    </div>
                )}
            </div>
        </aside>
    );
}
