import React from 'react';
import { Plus, X } from 'lucide-react';

interface DynamicListInputProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

export const DynamicListInput: React.FC<DynamicListInputProps> = ({
  label,
  items,
  onChange,
  placeholder = 'Enter value...',
}) => {
  const handleAdd = () => {
    onChange([...items, '']);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    onChange(newItems);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-600">{label}</label>
        <button
          type="button"
          onClick={handleAdd}
          className="text-[10px] font-semibold text-[#E85D88] hover:text-[#d44874] flex items-center gap-1 transition-colors"
        >
          <Plus className="h-3 w-3" /> ADD ITEM
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-slate-400 italic">No items added.</p>
        )}
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] transition placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
