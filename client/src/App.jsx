import { useState, useRef } from 'react'
import './App.css'

const LOADING_MESSAGES = ['Analyzing query', 'Synthesizing information', 'Preparing advice']

const EXAMPLES = [
  {
    q: "like math 1530 but more chill",
    svg: (
      <svg className="example-bg" viewBox="0 0 200 52" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="52" fill="#e8e6e3"/>
        <g opacity="0.35">
          <circle cx="18" cy="10" r="3.5" fill="#9a8fa0"/><circle cx="28" cy="10" r="3.5" fill="#b8aebe"/><circle cx="38" cy="10" r="3.5" fill="#cfc8d4"/><circle cx="48" cy="10" r="3.5" fill="#fff"/><circle cx="58" cy="10" r="3.5" fill="#b8aebe"/>
          <circle cx="18" cy="20" r="3.5" fill="#cfc8d4"/><circle cx="28" cy="20" r="3.5" fill="#fff"/><circle cx="38" cy="20" r="3.5" fill="#9a8fa0"/><circle cx="48" cy="20" r="3.5" fill="#b8aebe"/><circle cx="58" cy="20" r="3.5" fill="#cfc8d4"/>
          <circle cx="18" cy="30" r="3.5" fill="#b8aebe"/><circle cx="28" cy="30" r="3.5" fill="#9a8fa0"/><circle cx="38" cy="30" r="3.5" fill="#cfc8d4"/><circle cx="48" cy="30" r="3.5" fill="#9a8fa0"/><circle cx="58" cy="30" r="3.5" fill="#fff"/>
          <circle cx="18" cy="40" r="3.5" fill="#706878"/><circle cx="28" cy="40" r="3.5" fill="#b8aebe"/><circle cx="38" cy="40" r="3.5" fill="#706878"/><circle cx="48" cy="40" r="3.5" fill="#cfc8d4"/><circle cx="58" cy="40" r="3.5" fill="#9a8fa0"/>
        </g>
        <g opacity="0.3">
          <circle cx="85" cy="32" r="12" fill="none" stroke="#9a8fa0" strokeWidth="3"/>
          <circle cx="98" cy="24" r="10" fill="none" stroke="#b8aebe" strokeWidth="2.5"/>
        </g>
        <g opacity="0.25">
          <polygon points="140,8 165,4 158,22 135,18" fill="#b8aebe"/>
          <polygon points="155,18 180,12 185,38 158,36" fill="#cfc8d4"/>
          <polygon points="130,28 150,35 142,48 125,44" fill="#9a8fa0"/>
        </g>
      </svg>
    ),
  },
  {
    q: "drama intensive MWF 4+ instructor rating",
    svg: (
      <svg className="example-bg" viewBox="0 0 200 52" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="52" fill="#e8e6e3"/>
        <g opacity="0.28" transform="translate(20,4) scale(0.5)">
          <ellipse cx="40" cy="44" rx="32" ry="36" fill="#9a8fa0"/>
          <ellipse cx="28" cy="34" rx="6" ry="7" fill="#e8e6e3"/>
          <ellipse cx="52" cy="34" rx="6" ry="7" fill="#e8e6e3"/>
          <path d="M24 54 Q40 72 56 54" fill="none" stroke="#e8e6e3" strokeWidth="3" strokeLinecap="round"/>
        </g>
        <g opacity="0.22" transform="translate(148,2) scale(0.48)">
          <ellipse cx="40" cy="44" rx="32" ry="36" fill="#b8aebe"/>
          <ellipse cx="28" cy="34" rx="6" ry="7" fill="#e8e6e3"/>
          <ellipse cx="52" cy="34" rx="6" ry="7" fill="#e8e6e3"/>
          <path d="M24 60 Q40 46 56 60" fill="none" stroke="#e8e6e3" strokeWidth="3" strokeLinecap="round"/>
        </g>
        <g opacity="0.15">
          <path d="M70 0 Q80 20 75 52" fill="none" stroke="#9a8fa0" strokeWidth="8"/>
          <path d="M130 0 Q120 20 125 52" fill="none" stroke="#9a8fa0" strokeWidth="8"/>
          <path d="M75 4 Q100 14 125 4" fill="none" stroke="#b8aebe" strokeWidth="4"/>
        </g>
      </svg>
    ),
  },
  {
    q: "WRIT classes in economics",
    svg: (
      <svg className="example-bg" viewBox="0 0 200 52" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="52" fill="#e8e6e3"/>
        <g opacity="0.22">
          <line x1="20" y1="6" x2="20" y2="46" stroke="#9a8fa0" strokeWidth="2"/>
          <line x1="20" y1="46" x2="70" y2="46" stroke="#9a8fa0" strokeWidth="2"/>
          <path d="M24 10 Q45 26 66 42" fill="none" stroke="#b8aebe" strokeWidth="2.5"/>
          <path d="M24 42 Q45 26 66 10" fill="none" stroke="#9a8fa0" strokeWidth="2.5"/>
        </g>
        <g opacity="0.2">
          <rect x="90" y="28" width="8" height="18" rx="1" fill="#b8aebe"/>
          <rect x="102" y="18" width="8" height="28" rx="1" fill="#9a8fa0"/>
          <rect x="114" y="22" width="8" height="24" rx="1" fill="#cfc8d4"/>
          <rect x="126" y="12" width="8" height="34" rx="1" fill="#9a8fa0"/>
        </g>
        <g opacity="0.15">
          <text x="160" y="38" fontFamily="Georgia, serif" fontSize="36" fontWeight="700" fill="#9a8fa0">$</text>
        </g>
      </svg>
    ),
  },
]

function esc(s = '') {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

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

function renderAnswerHtml(text, citedCodes, resultsByCode) {
  let html = esc(text)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  for (const code of citedCodes) {
    const re = new RegExp('\\b' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
    const sections = resultsByCode[code]?.sections || []
    html = html.replace(re, `<a href="${cabLink(code, sections)}" target="_blank">${code}</a>`)
  }
  return html.split('\n\n').map(p => p.trim()).filter(Boolean).map(p => `<p>${p}</p>`).join('')
}

function CourseCard({ result, isCited }) {
  const [expanded, setExpanded] = useState(false)
  const { code, title, description = '', sections = [] } = result
  const isLong = description.length > 250
  const short = isLong ? truncateDesc(description) : description
  //Filter semesters, meets, and instrs by whether they match criteria.
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

function CappedList({ results, isCited, limit = 10 }) {
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

function DataModal({ onClose }) {
  return (
    <div className="modal-overlay active" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h3>What's being searched?</h3>
        <p>Our course recommendations are informed by Courses@Brown (CAB), <a href="https://www.thecriticalreview.org/" target="_blank" rel="noreferrer">Critical Review</a>, and other open data sources.</p> <br />
        <p>We'd love to hear feedback! Email eriq.xia@gmail.com with comments or suggestions.</p>
      </div>
    </div>
  )
}


export default function App() {
  //String params: query, loading, error, meta, answer.
  const [query, setQuery] = useState('')
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')
  const [meta, setMeta] = useState('')
  const [answer, setAnswer] = useState('')
  //Bool params: fallOnly, resultsMode, loading
  const [fallOnly, setFallOnly] = useState(false)
  const [resultsMode, setResultsMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  // cited, others, resultsByCode, citedCodes, showModal
  const [cited, setCited] = useState([])
  const [others, setOthers] = useState([])
  const [resultsByCode, setResultsByCode] = useState({})
  const [citedCodes, setCitedCodes] = useState([])

  const timerRef = useRef(null)
  const inputRef = useRef(null)

  //timer manages load message display.
  function startLoading() {
    let idx = 0
    setLoadingMsg(LOADING_MESSAGES[0])
    setLoading(true)
    timerRef.current = setInterval(() => {
      idx++
      if (idx < LOADING_MESSAGES.length) setLoadingMsg(LOADING_MESSAGES[idx])
    }, 2000)
  }

  function stopLoading() {
    clearInterval(timerRef.current)
    setLoading(false)
  }

  function exitResultsMode() {
    setResultsMode(false)
    setQuery('')
    setError('')
    setMeta('')
    setAnswer('')
    setCited([])
    setOthers([])
    inputRef.current?.focus()
  }

  async function handleSubmit(e) {
    e?.preventDefault()
    const q = query.trim()
    if (!q) return

    setResultsMode(true)
    setError('')
    setMeta('')
    setAnswer('')
    setCited([])
    setOthers([])
    startLoading()

    try {
      const res = await fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, fallOnly }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }

      const allResults = [...(data.filteredResults || []), ...(data.unfilteredResults || [])]
      setMeta(`${allResults.length} courses retrieved in ${data.time_ms} ms`)

      const byCode = {}
      for (const r of allResults) byCode[r.code] = r
      setResultsByCode(byCode)
      setCitedCodes(data.cited_courses || [])

      if (data.answer) {
        setAnswer(data.answer)
        setCited(data.filteredResults || [])
        setOthers(data.unfilteredResults || [])
      } else {
        setCited(allResults)
      }
    } catch (err) {
      setError('Request failed: ' + err.message)
    } finally {
      stopLoading()
    }
  }

  function runExample(q) {
    setQuery(q)
    setTimeout(() => handleSubmit(), 0)
  }

  return (
    <div className={`interface${resultsMode ? ' results-mode' : ''}`}>
      {/* Header (hidden in results mode) */}
      {!resultsMode && (
        <div className="header">
          <img src="/images/bruno.png" width="300" alt="Bruno" />
        </div>
      )}

      {/* Toolbar (shown in results mode) */}
      {resultsMode && (
        <div className="toolbar" style={{ cursor: 'pointer' }} onClick={exitResultsMode}>
          <img src="/images/bruno_tr.png" alt="Bruno" width="500" />
        </div>
      )}

      <form id="searchForm" className="search-form" onSubmit={handleSubmit}>
        <div className="search-bar">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="apma classes for biology concentrators"
            maxLength={500}
            autoFocus
          />
          <button type="submit" disabled={loading}>&#9654;</button>
        </div>
        <div className="form-options">
          <label className="fall26">
            <input type="checkbox" checked={fallOnly} onChange={e => setFallOnly(e.target.checked)} />
            Only search Fall &apos;26
          </label>
          <button type="button" className="data-info-link" onClick={() => setShowModal(true)}>
            What&apos;s being searched?
          </button>
        </div>
      </form>

      {!resultsMode && (
        <div className="example-queries">
          {EXAMPLES.map(({ q, svg }) => (
            <button key={q} className="example-query" onClick={() => runExample(q)}>
              {svg}
              <span className="example-text">{q}</span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div id="loading">
          <div className="loading-msg">{loadingMsg}</div>
          <div className="blinking-dots"><span>.</span><span>.</span><span>.</span></div>
        </div>
      )}

      {error && <div id="error">{error}</div>}
      {meta && <div id="meta">{meta}</div>}

      {answer && (
        <div
          id="answer"
          dangerouslySetInnerHTML={{ __html: renderAnswerHtml(answer, citedCodes, resultsByCode) }}
        />
      )}

      {cited.length > 0 && <div className="section-label">Best Matches</div>}
      <CappedList results={cited} isCited={true} />

      {others.length > 0 && <div className="section-label">Other Relevant Courses</div>}
      <CappedList results={others} isCited={false} />

      {showModal && <DataModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
