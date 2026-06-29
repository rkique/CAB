import { useState } from 'react'

function latestSrcdb(sections = []) {
  if (!sections.length) return '999999'
  return sections.reduce((best, s) => s.srcdb > best ? s.srcdb : best, sections[0].srcdb)
}

function cabLink(code, sections) {
  return 'https://cab.brown.edu/?keyword=' + encodeURIComponent(code) + '&srcdb=' + latestSrcdb(sections)
}

function fixDescLinks(html = '') {
  return html
    .replace(/href="\/search\/\?p=([^"]+)"/g, (_, code) => `href="https://cab.brown.edu/?keyword=${code}"`)
    .replace(/<a /g, '<a target="_blank" ')
}

function truncateDesc(html = '', max = 250) {
  if (html.length <= max) return html
  let t = html.slice(0, max).replace(/<a\s[^>]*$/, '').replace(/<\/?\w[^>]*$/, '')
  const open = (t.match(/<a[\s>]/gi) || []).length
  const close = (t.match(/<\/a>/gi) || []).length
  if (open > close) t += '</a>'
  return t + '...'
}

export function CourseCard({ result, isCited }) {
  const [expanded, setExpanded] = useState(false)
  const { code, title, description = '', sections = [] } = result
  const isLong = description.length > 250
  const short = isLong ? truncateDesc(description) : description
  const semesters = [...new Set(sections.map(s => s.semester).filter(Boolean))].slice(0, 4).join(', ')
  const meets = [...new Set(sections.map(s => s.meets).filter(m => m && m !== 'TBA'))].slice(0, 3).join(' / ') || 'TBA'
  const instrs = [...new Set(sections.map(s => s.instr).filter(Boolean))].slice(0, 3).join(', ')
  const href = cabLink(code, sections)

  return (
    <div
      className={`course-card${isCited ? ' cited' : ''}`}
      onClick={e => { if (e.target.tagName !== 'A') setExpanded(x => !x) }}
      style={{ cursor: 'pointer' }}>
      <div className="card-header">
        <div>
          <span className="card-code">
            <a href={href} target="_blank" rel="noreferrer">{code}</a>
          </span>
          <span className="card-title">{title}</span>
        </div>
      </div>
      <div
        className="card-desc"
        dangerouslySetInnerHTML={{ __html: fixDescLinks(expanded ? description : short) }}
      />
      {expanded && (
        <div className="card-meta">
          {instrs} · {meets}{semesters ? ` · ${semesters}` : ''}
        </div>
      )}
    </div>
  )
}

export function CappedList({ results, isCited, limit = 10 }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? results : results.slice(0, limit)
  const hidden = results.length - limit
  return (
    <>
      {visible.map(r => <CourseCard key={r.code} result={r} isCited={isCited} />)}
      {!showAll && hidden > 0 && (
        <button className="show-more-btn" onClick={() => setShowAll(true)}>
          Show {hidden} more
        </button>
      )}
    </>
  )
}
