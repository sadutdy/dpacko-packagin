import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-app-muted">This page does not exist.</p>
      <Link to="/" className="text-blue-600 underline">
        Go home
      </Link>
    </div>
  );
}
