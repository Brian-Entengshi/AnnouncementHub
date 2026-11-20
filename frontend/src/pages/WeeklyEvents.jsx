import ResourcePage from '../components/ResourcePage'
import { catalog } from '../services/catalog'
import Calendar from '../components/Calendar'

export default function WeeklyEvents() {
  return <ResourcePage config={catalog.events} list={Calendar} />
}
