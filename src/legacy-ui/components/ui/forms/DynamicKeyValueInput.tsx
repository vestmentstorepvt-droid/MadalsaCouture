import React from 'react';
import { Plus, X } from 'lucide-react';
import type { ProductAttribute } from '../../../services/adminProductsApi';

interface DynamicKeyValueInputProps {
  label: string;
  items: ProductAttribute[];
  onChange: (items: ProductAttribute[]) => void;
  labelPlaceholder?: string;
  valuePlaceholder?: string;
}

export const DynamicKeyValueInput: React.FC<DynamicKeyValueInputProps> = ({
  label,
  items,
  onChange,
  labelPlaceholder = 'Label (e.g. Color)',
  valuePlaceholder = 'Value (e.g. Red)',
}) => {
  const handleAdd = () => {
    onChange([...items, { label: '', value: '' }]);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: 'label' | 'value', val: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: val };
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
          <Plus className="h-3 w-3" /> ADD ROW
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-slate-400 italic">No attributes added.</p>
        )}
        {items.map((item, index) => (
          <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <input
              type="text"
              value={item.label}
              onChange={(e) => handleChange(index, 'label', e.target.value)}
              placeholder={labelPlaceholder}
              className="w-full sm:w-1/3 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] transition placeholder:text-slate-400"
            />
            <input
              type="text"
              value={item.value}
              onChange={(e) => handleChange(index, 'value', e.target.value)}
              placeholder={valuePlaceholder}
              className="flex-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] transition placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="self-end sm:self-auto p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
