import "./FileItem.css"

export default function FileItem({ file }) {
  return (
    <div className="file-item">
      <div className="file-icon">📄</div>
      <div className="file-info">
        <h4 className="file-name">{file.name}</h4>
        <p className="file-meta">
          {file.app} • {file.time}
        </p>
      </div>
      <div className="file-stats">
        <span className="file-collaborators">👥 {file.collaborators}</span>
        {file.size && <span className="file-size">{file.size}</span>}
      </div>
      <button className="file-action">⋯</button>
    </div>
  )
}
