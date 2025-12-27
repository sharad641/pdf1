export const uploadToDrive = async (accessToken: string, fileBytes: Uint8Array, filename: string): Promise<any> => {
  const metadata = {
    name: filename,
    mimeType: 'application/pdf',
  };

  const blob = new Blob([fileBytes], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', blob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} ${errorText}`);
  }

  return response.json();
};