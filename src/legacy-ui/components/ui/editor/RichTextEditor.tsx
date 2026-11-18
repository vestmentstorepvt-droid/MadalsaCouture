import React from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

const MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'link',
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your content here...',
  className = '',
}) => {
  return (
    <div className={`rich-text-editor-wrapper bg-white rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#E85D88]/20 focus-within:border-[#E85D88] ${className}`}>
      <style>{`
        .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid #e2e8f0;
          background-color: #f8fafc;
          padding: 8px 12px;
        }
        .ql-container.ql-snow {
          border: none;
          min-height: 150px;
          font-family: inherit;
        }
        .ql-editor {
          min-height: 150px;
          font-size: 0.875rem; /* text-sm */
          color: #334155; /* text-slate-700 */
        }
        .ql-editor.ql-blank::before {
          color: #94a3b8; /* text-slate-400 */
          font-style: normal;
        }
      `}</style>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={MODULES}
        formats={FORMATS}
        placeholder={placeholder}
      />
    </div>
  );
};

export default RichTextEditor;
