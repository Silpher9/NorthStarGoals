import React, { useRef, useEffect } from 'react';
import { Bold, Italic, List } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  onBlur?: () => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  className = '',
  minHeight = '80px',
  onBlur
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (editorRef.current) {
        // Only update if the new value is different from innerHTML
        // And we are not the ones who just caused the change (to prevent cursor jumps)
        if (editorRef.current.innerHTML !== value) {
             // If we are focused, avoid clobbering unless value is empty (reset)
             if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = value;
             } else if (value === '') {
                 editorRef.current.innerHTML = '';
             }
        }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      const html = editorRef.current.innerHTML;
      // Filter out empty artifacts like <br> which browsers sometimes add
      onChange(html === '<br>' ? '' : html);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
        editorRef.current.focus();
        handleInput();
    }
  };

  return (
    <div className={`flex flex-col border border-slate-700 rounded-lg overflow-hidden bg-slate-900/50 ${className}`}>
      <div className="flex items-center gap-1 p-1.5 bg-slate-800/50 border-b border-slate-700/50">
        <button 
            type="button"
            onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Bold"
        >
          <Bold size={14} />
        </button>
        <button 
            type="button"
            onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Italic"
        >
          <Italic size={14} />
        </button>
        <button 
            type="button"
            onMouseDown={(e) => { e.preventDefault(); execCommand('insertUnorderedList'); }}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Bullet List"
        >
          <List size={14} />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={onBlur}
        className="flex-grow p-3 focus:outline-none text-sm text-slate-300 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5"
        style={{ minHeight }}
        data-placeholder={placeholder}
      />
      <style>{`
        [contenteditable]:empty:before {
            content: attr(data-placeholder);
            color: #475569;
            pointer-events: none;
            display: block;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;