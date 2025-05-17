import MainLayout from '@/components/MainLayout'
import { useMatches, Outlet, useRouter, redirect, createFileRoute, useRouteContext } from '@tanstack/react-router'

export const Route = createFileRoute('/_logged-in')({
    component: LoggedInLayout,
    loader: async ({ context }) => {
        if (!context.user) {
            throw redirect({ to: '/login' })
        }
    },
})

function LoggedInLayout() {
    const matches = useMatches()

    const matchWithTitle = [...matches]
        .reverse()
        .find((d) => d.context.getTitle)

    const title = matchWithTitle?.context.getTitle() || 'Volunteers'
    return <>
        <MainLayout title={title}>
            <Outlet />
        </MainLayout>
    </>
}
