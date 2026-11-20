import ResourcePage from '../components/ResourcePage'
import { catalog } from '../services/catalog'

export default function Reservations() {
  return <ResourcePage config={catalog.reservations} />
}
