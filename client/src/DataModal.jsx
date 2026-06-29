export function DataModal({ onClose }) {
  return (
    <div className="modal-overlay active" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h3>What&apos;s being searched?</h3>
        <p>Our course recommendations are informed by Courses@Brown (CAB), <a href="https://www.thecriticalreview.org/" target="_blank" rel="noreferrer">Critical Review</a>, and other open data sources.</p> <br />
        <p>We&apos;d love to hear feedback! Email eriq.xia@gmail.com with comments or suggestions.</p>
      </div>
    </div>
  )
}
