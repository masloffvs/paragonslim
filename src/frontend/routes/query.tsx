import { createFileRoute } from '@tanstack/react-router'
import StageBuilder from '../components/StageBuilder'

export const Route = createFileRoute('/query')({
  component: QueryPage,
})

function QueryPage() {
  return (
    <div className="p-4">
      <h1 className="text-md font-bold mb-4 text-gray-50">Query Designer</h1>
      <StageBuilder />
    </div>
  )
}
