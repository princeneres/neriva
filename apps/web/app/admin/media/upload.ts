import { ApiError, type ProblemDetails } from '../../../lib/api';
import { apiUrl } from '../../../lib/api-url';
import { getAccessToken } from '../../../lib/auth-storage';

// Multipart upload helper local to the media section: `api.post` JSON-encodes
// its body, which would corrupt a FormData payload. fetch sets the multipart
// content-type (with boundary) itself.
export async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!response.ok) {
    let problem: ProblemDetails = { status: response.status };
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      // non-JSON error body; keep the bare status
    }
    throw new ApiError(problem);
  }
  return (await response.json()) as T;
}
