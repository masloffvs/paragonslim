import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import { Suspense, lazy, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import '../index.css'
import { scan } from 'react-scan'

const Sidebar = lazy(() => import('../components/Sidebar'))

export const Route = createRootRoute({
  component: () => {
    const location = useLocation()
    useEffect(() => {
      if (import.meta.env.DEV) {
        scan({ enabled: true })
      }
    }, [])

    return (
      <>
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        <main className="md:ml-48 border-l border-gray-900/20 min-h-screen overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </>
    )
  },
})
