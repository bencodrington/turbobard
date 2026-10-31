import { Button } from './Button'
import { FontAwesomeIconView } from './icons'
import './Welcome.css'

export function Welcome({
  onAddEnvironment,
}: {
  onAddEnvironment: () => void
}) {
  return (
    <section className="welcome" aria-labelledby="welcome-heading">
      <div className="welcome-content">
        <h2 id="welcome-heading" className="welcome-heading">
          <span>Music and effects</span>
          <span className="welcome-heading-middle">at the</span>
          <span>speed of sound.</span>
        </h2>
        <p className="welcome-description">
          Spice up your RPGs and immerse your table in rich soundscapes.
        </p>
        <ul className="welcome-benefits">
          <li>Fade between locations</li>
          <li>Easily find sounds when the party goes somewhere unexpected</li>
          <li>
            Completely free!{' '}
            <a
              className="welcome-donation"
              href="https://ko-fi.com/projectbench"
              target="_blank"
              rel="noreferrer"
            >
              Donations welcome
            </a>
          </li>
        </ul>
        <div className="welcome-start">
          <p>To get started,</p>
          <Button
            variant="primary"
            className="welcome-create"
            onClick={onAddEnvironment}
          >
            <FontAwesomeIconView iconId="plus" /> Add environment
          </Button>
        </div>
      </div>
    </section>
  )
}
