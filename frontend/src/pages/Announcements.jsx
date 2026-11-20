import ResourcePage from '../components/ResourcePage'
import { catalog } from '../services/catalog'

export default function Announcements() {
  return <ResourcePage config={catalog.announcements}/>
}
