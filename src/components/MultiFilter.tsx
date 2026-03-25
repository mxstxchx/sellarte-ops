'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

interface MultiFilterProps {
  label: string
  options: [string, string][]    // [value, displayLabel]
  selected: string[]
  onChange: (vals: string[]) => void
  placeholder?: string
}

export default function MultiFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Buscar…',
}: MultiFilterProps) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = search
    ? options.filter(([, lbl]) => lbl.toLowerCase().includes(search.toLowerCase()))
    : options

  function toggle(val: string) {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val))
    } else {
      onChange([...selected, val])
    }
  }

  const hasSelection = selected.length > 0

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch('') }}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors
          ${hasSelection
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
      >
        <span className="font-medium">{label}</span>
        {hasSelection && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">Sin resultados</p>
            ) : (
              filtered.map(([val, lbl]) => {
                const checked = selected.includes(val)
                return (
                  <label
                    key={val}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50
                      ${checked ? 'bg-blue-50/60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(val)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-400 shrink-0"
                    />
                    <span className="text-xs text-gray-700 leading-tight line-clamp-2">{lbl}</span>
                  </label>
                )
              })
            )}
          </div>

          {/* Clear */}
          {hasSelection && (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors w-full"
              >
                <X className="w-3 h-3" />
                Limpiar selección ({selected.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
