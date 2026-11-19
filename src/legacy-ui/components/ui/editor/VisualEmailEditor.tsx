import React, { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link,
  Minus,
  Sparkles,
} from 'lucide-react';

interface VariableOption {
  key: string;
  label: string;
}

interface VisualEmailEditorProps {
  value: string;
  onChange: (html: string) => void;
  availableVariables?: VariableOption[];
  placeholder?: string;
}

export const VisualEmailEditor: React.FC<VisualEmailEditorProps> = ({
  value,
  onChange,
  availableVariables = [],
  placeholder = 'Type your email content here...',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Sync external value with editor innerHTML only when changed externally
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = DOMPurify.sanitize(value || '');
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: string, val: string | undefined = undefined) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  const insertVariable = (variableKey: string) => {
    const token = `{{${variableKey}}}`;
    document.execCommand('insertHTML', false, `<strong>${token}</strong>&nbsp;`);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  const handleCreateLink = () => {
    const url = prompt('Enter website URL (e.g. https://madalsacouture.com):')?.trim();
    if (!url) return;
    if (!/^(https?:\/\/|mailto:)/i.test(url)) {
      window.alert('Only http(s) and mailto links are allowed.');
      return;
    }
    executeCommand('createLink', url);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col">
      {/* ── Visual Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200">
        {/* Headings */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h2>')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Large Heading"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h3>')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Subheading"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<p>')}
            className="px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Normal Paragraph"
          >
            Text
          </button>
        </div>

        {/* Inline formatting */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('bold')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('italic')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('underline')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Underline (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('insertUnorderedList')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertOrderedList')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('justifyLeft')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('justifyCenter')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('justifyRight')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>

        {/* Links & Divider */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleCreateLink}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Insert Web Link"
          >
            <Link className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertHorizontalRule')}
            className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
            title="Insert Divider Line"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Variable Inserter Bar (Non-technical) ────────────────────────── */}
      {availableVariables.length > 0 && (
        <div className="px-3 py-2 bg-pink-50/50 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Insert Dynamic Data:
          </span>
          {availableVariables.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-pink-200 text-slate-700 hover:border-ink hover:text-accent shadow-xs transition"
              title={`Click to insert ${v.label}`}
            >
              + {v.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Editable Canvas ─────────────────────────────────────────────── */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-4 min-h-56 max-h-96 overflow-y-auto focus:outline-none prose prose-slate prose-sm max-w-none text-slate-800 leading-relaxed font-sans"
        data-placeholder={placeholder}
      />
    </div>
  );
};

export default VisualEmailEditor;
