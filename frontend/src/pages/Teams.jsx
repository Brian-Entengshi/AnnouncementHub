import ResourcePage from '../components/ResourcePage'
import { catalog } from '../services/catalog'

export default function Teams() {
  return <ResourcePage config={catalog.teams} />
}
