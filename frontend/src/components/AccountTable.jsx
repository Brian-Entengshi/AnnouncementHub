import { Link } from 'react-router-dom'
import { Eye, KeyRound, Pencil, UserRoundCheck, UserRoundX } from 'lucide-react'
import { Badge } from './Common'
import { formatDate } from '../utils/format'

const headings = [
  'Name',
  'Username',
  'Role',
  'Position / Team',
  'Status',
  'Created',
  'Actions',
]
const roleNames = {
  adviser: 'Admin / Adviser',
  officer: 'Organization Officer',
  staff: 'Organization Staff',
}

export default function AccountTable({ accounts, onStatus }) {
  return (
    <table className="audit-table account-table" aria-label="Accounts">
      <thead>
        <tr>
          {headings.map((name) => (
            <th key={name} scope="col">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => {
          const path = '/accounts/' + account.id
          const name = account.full_name || account.username
          const cells = [
            <Link key="name" className="account-name" to={path}>
              {name}
            </Link>,
            account.username,
            <span key="role" className={'role-badge role-' + account.role}>
              {roleNames[account.role]}
            </span>,
            account.role === 'staff'
              ? account.assigned_teams
                  .map(
                    ({ name, is_active }) =>
                      name + (is_active ? '' : ' (inactive)'),
                  )
                  .join(', ') || '—'
              : account.position || '—',
            <Badge
              key="status"
              value={account.is_active ? 'active' : 'inactive'}
            />,
            formatDate(account.date_joined),
            <div key="actions" className="table-actions">
              <Link to={path} aria-label={'View ' + name} title="View details">
                <Eye size={16} />
              </Link>
              <Link
                to={path + '/edit'}
                aria-label={'Edit ' + name}
                title="Edit account"
              >
                <Pencil size={16} />
              </Link>
              <Link
                to={path + '/edit?password=1'}
                aria-label={'Replace temporary password for ' + name}
                title="Replace temporary password"
              >
                <KeyRound size={16} />
              </Link>
              {account.can_change_status && (
                <button
                  type="button"
                  onClick={() => onStatus(account)}
                  aria-label={
                    (account.is_active ? 'Deactivate ' : 'Activate ') + name
                  }
                  title={account.is_active ? 'Deactivate' : 'Activate'}
                >
                  {account.is_active ? (
                    <UserRoundX size={16} />
                  ) : (
                    <UserRoundCheck size={16} />
                  )}
                </button>
              )}
            </div>,
          ]
          return (
            <tr key={account.id}>
              {cells.map((value, index) => (
                <td key={headings[index]} data-label={headings[index]}>
                  {value}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
