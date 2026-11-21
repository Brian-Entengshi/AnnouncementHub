import {
  PublicAnnouncements,
  PublicClubEvents,
} from '../components/PublicListings'
import {
  PublicAboutSection,
  PublicContactsSection,
  PublicHomeSection,
} from '../components/StudentSections'
import { useData } from '../hooks/useData'
import PublicUsefulLinks from '../components/PublicUsefulLinks'

export default function StudentHome() {
  const settings = useData('organization/')
  const content = settings.data || {}
  return (
    <>
      <div id="home">
        <PublicHomeSection content={content} />
      </div>
      <section id="about" className="public-section public-about-section">
        <PublicAboutSection content={content} />
      </section>
      <PublicAnnouncements
        highlightPinned={content.highlight_pinned === true}
      />
      <PublicClubEvents />
      <PublicUsefulLinks />
      <section id="contacts" className="public-section public-contacts-section">
        <PublicContactsSection content={content} />
        {settings.error && (
          <p className="public-width public-settings-error" role="status">
            {settings.error}{' '}
            <button type="button" onClick={settings.reload}>
              Retry
            </button>
          </p>
        )}
      </section>
    </>
  )
}
