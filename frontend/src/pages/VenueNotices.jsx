import ResourcePage from '../components/ResourcePage'
import { catalog } from '../services/catalog'

export default function VenueNotices() {
  return <ResourcePage config={catalog.notices} />
}
