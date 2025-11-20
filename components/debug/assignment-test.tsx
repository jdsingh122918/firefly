'use client';

import { useEffect, useState } from 'react';

export function AssignmentTest() {
  console.log('🚨 [Assignment Test] Component initializing...');

  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🚨 [Assignment Test] useEffect triggered');

    const testAPI = async () => {
      try {
        console.log('🚨 [Assignment Test] Making API call...');

        const response = await fetch('/api/assignments?view=assigned&page=1&limit=10', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log('🚨 [Assignment Test] API response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('🚨 [Assignment Test] API error:', errorText);
          setError(`API Error: ${response.status} - ${errorText}`);
          return;
        }

        const data = await response.json();
        console.log('🚨 [Assignment Test] API success:', data);
        setResult(data);

      } catch (err) {
        console.error('🚨 [Assignment Test] Exception:', err);
        setError(`Exception: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    testAPI();
  }, []);

  console.log('🚨 [Assignment Test] Rendering with result:', result, 'error:', error);

  return (
    <div className="p-4 border rounded bg-yellow-50">
      <h2 className="font-bold text-lg mb-2">🚨 Assignment API Test</h2>

      {error && (
        <div className="text-red-600 mb-2">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="text-green-600 mb-2">
          <strong>Success:</strong> Got {result.assignments?.length || 0} assignments
        </div>
      )}

      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
        {JSON.stringify({ result, error }, null, 2)}
      </pre>
    </div>
  );
}