import React, { useState, useRef, useEffect } from 'react';

/**
 * MentionTargetsPicker - Component for selecting mention targets (roles, @everyone, @here)
 */
export default function MentionTargetsPicker({ value, onChange, roles }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const list = value || [];
  
  useEffect(() => {
    function onDoc(e) { 
      if (!boxRef.current) return; 
      if (!boxRef.current.contains(e.target)) setOpen(false); 
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  
  const baseOptions = [
    { id: 'everyone', label: '@everyone', type: 'meta' },
    { id: 'here', label: '@here', type: 'meta' },
    ...((roles || []).map(r => ({ id: r.id, label: r.name, type: 'role' })))
  ];
  
  const filtered = baseOptions
    .filter(o => !query || o.label.toLowerCase().includes(query.toLowerCase()))
    .filter(o => !list.includes(o.id));
  
  const [activeIdx, setActiveIdx] = useState(0);
  
  useEffect(() => { 
    setActiveIdx(0); 
  }, [query, open]);
  
  function add(id) { 
    if (!list.includes(id)) onChange([...list, id]); 
    setQuery(''); 
    setOpen(false); 
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0); 
  }
  
  function remove(id) { 
    onChange(list.filter(x => x !== id)); 
  }
  
  function handleKey(e) {
    if (e.key === 'Backspace' && !query) { 
      onChange(list.slice(0, -1)); 
    } else if (e.key === 'Enter') { 
      e.preventDefault(); 
      if (open && filtered[activeIdx]) add(filtered[activeIdx].id); 
    } else if (e.key === 'ArrowDown') { 
      e.preventDefault(); 
      setOpen(true); 
      setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); 
    } else if (e.key === 'ArrowUp') { 
      e.preventDefault(); 
      setActiveIdx(i => Math.max(0, i - 1)); 
    }
  }
  
  return (
    <div className="mention-targets-picker" ref={boxRef}>
      <div 
        className="mention-targets-box" 
        onClick={() => { 
          setOpen(true); 
          inputRef.current && inputRef.current.focus(); 
        }}
      >
        {list.map(id => {
          const opt = baseOptions.find(o => o.id === id);
          const label = opt ? opt.label : (id.startsWith('@') ? id : `<@&${id}>`);
          return (
            <span key={id} className={"mention-chip " + (opt?.type === 'role' ? 'role' : '')}>
              {label}
              <button 
                type="button" 
                onClick={e => { 
                  e.stopPropagation(); 
                  remove(id); 
                }}
              >
                &times;
              </button>
            </span>
          );
        })}
        <input 
          ref={inputRef} 
          value={query} 
          placeholder={list.length ? '' : 'Add @everyone, @here or role…'} 
          onFocus={() => setOpen(true)} 
          onChange={e => { 
            setQuery(e.target.value); 
            setOpen(true); 
          }} 
          onKeyDown={handleKey} 
        />
      </div>
      
      {open && filtered.length > 0 && (
        <div className="mention-targets-suggestions">
          {filtered.slice(0, 40).map((o, idx) => (
            <button 
              type="button" 
              key={o.id} 
              className={idx === activeIdx ? 'active' : ''} 
              onMouseEnter={() => setActiveIdx(idx)} 
              onClick={() => add(o.id)}
            >
              {o.label}
              <span className="meta">{o.type}</span>
            </button>
          ))}
        </div>
      )}
      
      {open && filtered.length === 0 && (
        <div className="mention-targets-suggestions">
          <div className="text-muted small p-2" style={{fontSize: '.55rem'}}>
            No matches
          </div>
        </div>
      )}
    </div>
  );
}
