import ResourcePage from '../components/ResourcePage'
import { catalog } from '../services/catalog'

export default function Accounts() {
  return <ResourcePage config={catalog.accounts} />
}
