import { useData } from '../hooks/useData'
import { Heading, State } from '../components/Common'
import LandingPageEditor from '../components/LandingPageEditor'
import '../styles/landing-settings.css'

export default function Settings() {
  const query = useData('settings/')

  return (
    <>
      <Heading
        kicker="Administration"
        title="Organization settings"
        description="Manage what students see on the public landing page."
      />
      <State query={query}>
        {(settings) => <LandingPageEditor initial={settings} />}
      </State>
    </>
  )
}
