/**
 * Safely parses a response as JSON, handling non-JSON responses gracefully
 * @param response The fetch Response object
 * @returns A promise that resolves to the parsed JSON or an error object
 */
export async function safeParseJSON(response: Response): Promise<any> {
  try {
    const text = await response.text();
    
    // Try to parse as JSON
    try {
      return JSON.parse(text);
    } catch (e) {
      // If parsing fails, return a formatted error object
      return {
        error: text || response.statusText || "Unknown error"
      };
    }
  } catch (error) {
    // If even getting text fails, return a generic error
    return {
      error: response.statusText || "Unknown error"
    };
  }
}

/**
 * Handles API response errors, ensuring proper error objects are returned
 * @param response The fetch Response object
 * @throws Error with formatted message
 */
export async function handleResponseError(response: Response): Promise<void> {
  if (!response.ok) {
    const errorData = await safeParseJSON(response);
    const errorMessage = errorData.error || errorData.message || response.statusText || "Unknown error";
    throw new Error(`${response.status}: ${errorMessage}`);
  }
}
