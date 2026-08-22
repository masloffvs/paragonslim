import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="flex justify-center items-center h-screen">
      <h1 >
        Hello from React + Tailwind + TanStack Router!
      </h1>
    </div>
  )
}
