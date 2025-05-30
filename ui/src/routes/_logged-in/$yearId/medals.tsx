import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_logged-in/$yearId/medals')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_logged-in/$yearId/medals"!</div>
}
