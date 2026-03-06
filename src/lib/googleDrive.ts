import { WorkInstruction } from '@/types/instruction';

const FOLDER_NAME = 'WorkInstructions';
const FILE_NAME = 'work_instructions.json';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface DriveFileList {
  files: DriveFile[];
}

async function findFolder(): Promise<string | null> {
  const res = await gapi.client.request<DriveFileList>({
    path: 'https://www.googleapis.com/drive/v3/files',
    params: {
      q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
    },
  });
  const files = res.result.files;
  return files.length > 0 ? files[0].id : null;
}

async function createFolder(): Promise<string> {
  const res = await gapi.client.request<DriveFile>({
    path: 'https://www.googleapis.com/drive/v3/files',
    method: 'POST',
    body: {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
  });
  return res.result.id;
}

async function findOrCreateFolder(): Promise<string> {
  const existing = await findFolder();
  if (existing) return existing;
  return createFolder();
}

async function findFile(folderId: string): Promise<string | null> {
  const res = await gapi.client.request<DriveFileList>({
    path: 'https://www.googleapis.com/drive/v3/files',
    params: {
      q: `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
    },
  });
  const files = res.result.files;
  return files.length > 0 ? files[0].id : null;
}

export async function saveInstructionsToDrive(
  instructions: WorkInstruction[],
): Promise<void> {
  const folderId = await findOrCreateFolder();
  const fileId = await findFile(folderId);
  const content = JSON.stringify(instructions, null, 2);

  const boundary = '===boundary===';
  const metadata = fileId
    ? { name: FILE_NAME, mimeType: 'application/json' }
    : { name: FILE_NAME, mimeType: 'application/json', parents: [folderId] };

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const path = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}`
    : 'https://www.googleapis.com/upload/drive/v3/files';

  await gapi.client.request({
    path,
    method: fileId ? 'PATCH' : 'POST',
    params: { uploadType: 'multipart' },
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
}

export async function loadInstructionsFromDrive(): Promise<WorkInstruction[] | null> {
  const folderId = await findFolder();
  if (!folderId) return null;

  const fileId = await findFile(folderId);
  if (!fileId) return null;

  const res = await gapi.client.request<WorkInstruction[]>({
    path: `https://www.googleapis.com/drive/v3/files/${fileId}`,
    params: { alt: 'media' },
  });

  return res.result;
}
