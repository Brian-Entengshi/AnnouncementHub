import ResourcePage from '../components/ResourcePage'
import { catalog } from '../services/catalog'

export default function UsefulLinks() {
  return <ResourcePage config={catalog.links}/>
}
