import { useData } from '../hooks/useData'
import { State, Empty, Heading } from '../components/Common'
import { stamp } from '../utils/format'
export default function Audit() {
  const q = useData('audit/', true)
  return (
    <>
      <Heading
        kicker="Administration"
        title="Activity records"
        description="A chronological record of organization changes."
      />
      <section className="panel detail">
        <State query={q}>
          {(rows) =>
            rows.length ? (
              rows.map((r) => (
                <div className="list-row" key={r.id}>
                  <div>
                    <strong>
                      {r.action} · {r.label}
                    </strong>
                    <small>
                      {r.resource} · {r.actor}
                    </small>
                  </div>
                  <small>{stamp(r.at)}</small>
                </div>
              ))
            ) : (
              <Empty>No changes recorded yet.</Empty>
            )
          }
        </State>
      </section>
    </>
  )
}
