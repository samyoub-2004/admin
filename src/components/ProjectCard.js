import "./ProjectCard.css"

export default function ProjectCard({ project }) {
  return (
    <div className="project-card">
      <div className="project-header">
        <h3>{project.name}</h3>
        <span className="project-due">{project.dueDate}</span>
      </div>
      <p className="project-description">{project.description}</p>
      <div className="project-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${project.progress}%` }}></div>
        </div>
        <span className="progress-text">{project.progress}%</span>
      </div>
      <div className="project-footer">
        <div className="project-stat">
          <span>👥</span>
          <span>{project.members} members</span>
        </div>
        <div className="project-stat">
          <span>📁</span>
          <span>{project.files} files</span>
        </div>
      </div>
    </div>
  )
}
