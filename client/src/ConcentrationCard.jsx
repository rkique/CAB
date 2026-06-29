import { useState } from 'react'

function cabSearchLink(code) {
  return 'https://cab.brown.edu/?keyword=' + encodeURIComponent(code)
}

export function ConcentrationCard({ concentration }) {
  const [expanded, setExpanded] = useState(false)
  const trackKeys = Object.keys(concentration.tracks || {})
  const defaultTrack = trackKeys.includes('ab') ? 'ab' : trackKeys[0]
  const [activeTrack, setActiveTrack] = useState(defaultTrack)

  if (!trackKeys.length) return null

  const track = concentration.tracks[activeTrack]
  const showToggle = trackKeys.filter(k => k !== 'general').length > 1

  function renderItem(item, idx) {
    if (item.type === 'course') {
      return (
        <div key={idx} className={`conc-course${item.isOr ? ' conc-or' : ''}`}>
          {item.isOr && <span className="conc-or-label">or</span>}
          <a href={cabSearchLink(item.code)} target="_blank" rel="noreferrer" className="conc-code">
            {item.code}{item.code2 ? ` & ${item.code2}` : ''}
          </a>
          <span className="conc-title">{item.title}</span>
        </div>
      )
    }
    if (item.type === 'label') {
      const isHeader = !item.count && item.text.length < 60
      return (
        <div key={idx} className={`conc-label${isHeader ? ' conc-label-header' : ''}`}>
          {item.text}{item.count ? ` (${item.count})` : ''}
        </div>
      )
    }
    return null
  }

  return (
    <div className="conc-card">
      <div className="conc-chip" onClick={() => setExpanded(x => !x)}>
        <div className="conc-chip-left">
          {/* <span className="conc-chip-label">concentration</span> */}
          <span className="conc-chip-name">{concentration.name}</span>
          {track?.totalCredits && <span className="conc-chip-credits">{track.totalCredits} cr</span>}
        </div>
        <div className="conc-chip-right">
          {showToggle && (
            <div className="conc-track-toggle" onClick={e => e.stopPropagation()}>
              {trackKeys.filter(k => k !== 'general').map(k => (
                <button
                  key={k}
                  className={`conc-track-btn${activeTrack === k ? ' active' : ''}`}
                  onClick={() => setActiveTrack(k)}
                >
                  {concentration.tracks[k].label}
                </button>
              ))}
            </div>
          )}
          <span className="conc-expand-icon">{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {expanded && track && (
        <div className="conc-body">
          {track.sections.map((section, si) => (
            <div key={si} className="conc-section">
              {section.heading && <div className="conc-section-heading">{section.heading}</div>}
              <div className="conc-items">
                {section.items.map((item, ii) => renderItem(item, ii))}
              </div>
            </div>
          ))}
          {concentration.url && (
            <a href={concentration.url} target="_blank" rel="noreferrer" className="conc-more-link">
              Full requirements ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}
