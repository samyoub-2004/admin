import "./HeroSection.css"

export default function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-badge">Premium</div>
        <h1 className="hero-title">Bienvenue sur LilyAdmin</h1>
        <p className="hero-description">
          Gérez vos réservations, chauffeurs et itinéraires depuis un tableau de bord moderne et performant.
        </p>
        <div className="hero-buttons">
          <button className="btn btn-primary">Ouvrir le tableau de bord</button>
          <button className="btn btn-secondary">En savoir plus</button>
        </div>
      </div>
      <div className="hero-visual">
        <div className="hero-circle"></div>
      </div>
    </section>
  )
}
