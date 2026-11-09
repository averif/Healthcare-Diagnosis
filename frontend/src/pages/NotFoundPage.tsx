import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-brand-600 underline">
        Back to home
      </Link>
    </div>
  )
}
