import React, { useState, useEffect, useRef } from 'react';
import { searchComuni, ComuneItem } from '../services/comuniService';
import { MapPin, Loader2, Check } from 'lucide-react';

export interface ComuneAutocompleteInputProps {
  value: string;
  onChange: (comuneName: string, comuneItem?: ComuneItem | null) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
}

export const ComuneAutocompleteInput: React.FC<ComuneAutocompleteInputProps> = ({
  value,
  onChange,
  placeholder = "Cerca o digita comune (es. Milano, Roma, Gallarate...)",
  label,
  required = false,
  className = "",
  inputClassName = "",
}) => {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<ComuneItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setQuery(text);
    onChange(text, null);

    if (text.trim().length >= 2) {
      setIsLoading(true);
      try {
        const results = await searchComuni(text);
        setSuggestions(results);
        setIsOpen(true);
      } catch (err) {
        console.warn('Error searching comuni:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSelectComune = (item: ComuneItem) => {
    setQuery(item.nome);
    onChange(item.nome, item);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
          <span>{label} {required && <span className="text-red-500">*</span>}</span>
          <span className="text-[10px] text-emerald-800 font-normal bg-emerald-100 px-2 py-0.5 rounded-full">
            7.904 Comuni Italiani Ufficiali
          </span>
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className={
            inputClassName ||
            "w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border-2 border-emerald-300 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
          }
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4 text-emerald-600" />
          )}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white border-2 border-emerald-400 rounded-xl shadow-xl divide-y divide-slate-100 ring-1 ring-black/5">
          <div className="p-2 bg-emerald-50 text-[11px] font-bold text-emerald-900 flex items-center justify-between border-b border-emerald-100">
            <span>Comune italiano tracciato:</span>
            <span className="font-mono text-emerald-700">{suggestions.length} trovati</span>
          </div>
          {suggestions.map((item) => (
            <button
              key={`${item.nome}-${item.cap}`}
              type="button"
              onClick={() => handleSelectComune(item)}
              className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-xs flex items-center justify-between transition-colors cursor-pointer group"
            >
              <div className="flex items-center space-x-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                <span className="font-extrabold text-slate-900">{item.nome}</span>
                <span className="text-[11px] font-semibold text-slate-500">
                  ({item.sigla}) - {item.regione}
                </span>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
                  {item.cap}
                </span>
                {query.toLowerCase() === item.nome.toLowerCase() && (
                  <Check className="w-4 h-4 text-emerald-600" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
