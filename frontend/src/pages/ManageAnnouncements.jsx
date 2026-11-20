import ResourcePage from '../components/ResourcePage'
import { catalog } from '../services/catalog'

export default function ManageAnnouncements() {
  return <ResourcePage config={catalog.announcements} managed/>
}
