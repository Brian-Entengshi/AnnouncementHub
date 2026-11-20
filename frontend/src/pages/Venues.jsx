import ResourcePage from '../components/ResourcePage'
import { catalog } from '../services/catalog'

export default function Venues() {
  return <ResourcePage config={catalog.venues} />
}
