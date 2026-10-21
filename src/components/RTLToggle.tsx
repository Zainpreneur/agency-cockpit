import { useState, useEffect } from 'react'
import { PageHeader, SectionCard } from '../components/Layout'
import { Chip } from '../components/StatusChip'

export function RTLToggle() {
  const [rtl, setRtl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rtl') === 'true'
    }
    return false
  })

  useEffect(() => {
    if (rtl) {
      document.documentElement.setAttribute('dir', 'rtl')
      document.documentElement.classList.add('rtl')
      localStorage.setItem('rtl', 'true')
    } else {
      document.documentElement.setAttribute('dir', 'ltr')
      document.documentElement.classList.remove('rtl')
      localStorage.setItem('rtl', 'false')
    }
  }, [rtl])

  return (
    <button
      onClick={() => setRtl(!rtl)}
      className={`shrink-0 rounded-full w-12 h-6 transition relative ${rtl ? 'bg-blue-600' : 'bg-gray-300'}`}
      aria-pressed={rtl}
      title="Toggle RTL/Arabic layout"
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${rtl ? 'left-6.5' : 'left-0.5'}`} />
    </button>
  )
}