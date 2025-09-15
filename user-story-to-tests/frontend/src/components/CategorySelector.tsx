import React from 'react'

type Props = {
  categories: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function CategorySelector({ categories, selected, onChange }: Props) {
  const toggle = (cat: string) => {
    if (selected.includes(cat)) onChange(selected.filter(c => c !== cat))
    else onChange([...selected, cat])
  }

  return (
    <div className="category-grid" role="group" aria-label="Test categories">
      {categories.map(cat => (
        <label
          key={cat}
          className={`category ${selected.includes(cat) ? 'selected' : ''}`}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(cat) } }}
        >
          <input
            type="checkbox"
            checked={selected.includes(cat)}
            onChange={() => toggle(cat)}
            aria-checked={selected.includes(cat)}
          />
          <span className="custom-check" aria-hidden />
          <span className="category-label">{cat}</span>
        </label>
      ))}
    </div>
  )
}
