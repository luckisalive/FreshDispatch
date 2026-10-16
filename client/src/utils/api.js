// client/src/utils/api.js

/**
 * Sends a verification request to the backend API.
 * Supports both JSON payloads (text/link/question) and multipart/form-data (image).
 * 
 * @param {string} type 'text' | 'link' | 'image' | 'question'
 * @param {string|File} payload The text, url, question, or image File object
 * @returns {Promise<object>} The validated JSON response
 */
export async function checkContent(type, payload) {
  let options;

  if (type === 'image') {
    const formData = new FormData();
    formData.append('type', 'image');
    formData.append('image', payload);

    options = {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type header manually for FormData; browser sets boundary
    };
  } else {
    options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, payload }),
    };
  }

  const response = await fetch('/api/check', options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}
