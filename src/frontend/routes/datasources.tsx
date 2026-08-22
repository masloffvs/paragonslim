import { createFileRoute } from '@tanstack/react-router'
import useSWR from 'swr'
import DatasetTableView from '../views/DatasetTableView'

export const Route = createFileRoute('/datasources')({
  component: Datasources,
})

const fetcher = (url: string) => fetch(url).then(res => res.json())

function Datasources() {
  const { data, error, isLoading } = useSWR('/api/datasets', fetcher)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading datasets</div>

  return (
    <div className="p-4">
      <h1 className="text-md font-bold mb-2">Datasources</h1>
      <div className="bg-gray-900/20 rounded-lg">
        <DatasetTableView datasets={data} />
      </div>
    </div>
  )
}
