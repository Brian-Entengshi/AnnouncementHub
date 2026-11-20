import ResourcePage from '../components/ResourcePage'
import { catalog } from '../services/catalog'

export default function Activities() {
  return <ResourcePage config={catalog.activities}/>
}
