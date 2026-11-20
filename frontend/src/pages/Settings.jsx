import { useState } from 'react'
import { useData } from '../hooks/useData'
import { api } from '../services/api'
import { Heading, State } from '../components/Common'
export default function Settings() {
  const q=useData('settings/'), [message,setMessage]=useState('')
  async function save(e) { e.preventDefault();try{await api('settings/',{method:'PATCH',body:Object.fromEntries(new FormData(e.target))});setMessage('Organization settings saved.');q.reload()}catch(err){setMessage(err.message)} }
  return <><Heading kicker="Administration" title="Organization settings" description="Update the contact details shown in the member help panel."/><State query={q}>{r=><form className="panel form" onSubmit={save}><label>Contact email<input type="email" name="contact_email" defaultValue={r.contact_email}/></label><label>Office hours<input name="office_hours" defaultValue={r.office_hours}/></label><button className="primary">Save settings</button></form>}</State><p role="status">{message}</p></>
}
