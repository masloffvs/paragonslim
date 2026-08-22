import { createFileRoute } from '@tanstack/react-router'
import useSWR from 'swr'
import ClientTableView from '../views/ClientTableView'

export const Route = createFileRoute('/clients')({
  component: Clients,
})

const fetcher = (url: string) => fetch(url).then(res => res.json())

function Clients() {
  const { data, error, isLoading } = useSWR('/api/clients', fetcher)

  if (isLoading) return <div className="p-4 text-gray-400">Loading...</div>
  if (error) return <div className="p-4 text-red-400">Error loading clients</div>

  return (
    <div className="p-4">
      <h1 className="text-md font-bold mb-2 text-gray-50">ClickHouse Clients</h1>
      <div className="bg-gray-900/20 rounded-lg">
        <ClientTableView clients={data || []} />
      </div>
    </div>
  )
}
