import { DatabaseUnavailable } from "@/components/errors/database-unavailable";

interface DatabaseUnavailablePageProps {
  searchParams: Promise<{
    error?: string;
    errorType?: 'CONNECTION' | 'TIMEOUT' | 'AUTH' | 'UNKNOWN';
    retryAfter?: string;
  }>;
}

export default async function DatabaseUnavailablePage({
  searchParams
}: DatabaseUnavailablePageProps) {
  const params = await searchParams;

  return (
    <DatabaseUnavailable
      error={params.error}
      errorType={params.errorType || 'CONNECTION'}
      retryAfter={params.retryAfter ? parseInt(params.retryAfter) : 30}
      showRetry={true}
      onRetry={() => {
        // Redirect back to dashboard after retry
        window.location.href = '/admin';
      }}
    />
  );
}