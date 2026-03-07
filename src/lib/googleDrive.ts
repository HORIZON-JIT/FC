import { WorkInstruction } from '@/types/instruction';

const DEFAULT_FOLDER_NAME = 'WorkInstructions';
const FILE_NAME = 'work_instructions.json';
const STORAGE_KEY_FOLDER = 'drive_target_folder';

export interface DriveFolder {
  id: string;
  name: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface DriveFileList {
  files: DriveFile[];
}

// --- Target folder management ---

export function getTargetFolder(): DriveFolder | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_FOLDER);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setTargetFolder(folder: DriveFolder | null): void {
  if (folder) {
    localStorage.setItem(STORAGE_KEY_FOLDER, JSON.stringify(folder));
  } else {
    localStorage.removeItem(STORAGE_KEY_FOLDER);
  }
}

// --- Folder browsing ---

export async function listFolders(parentId?: string): Promise<DriveFolder[]> {
  const parentQuery = parentId
    ? `'${parentId}' in parents and`
    : `'root' in parents and`;
  const res = await gapi.client.request<DriveFileList>({
    path: 'https://www.googleapis.com/drive/v3/files',
    params: {
      q: `${parentQuery} mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      orderBy: 'name',
      pageSize: '100',
      spaces: 'drive',
    },
  });
  return res.result.files.map((f) => ({ id: f.id, name: f.name }));
}

export async function createNewFolder(name: string, parentId?: string): Promise<DriveFolder> {
  const body: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) body.parents = [parentId];
  const res = await gapi.client.request<DriveFile>({
    path: 'https://www.googleapis.com/drive/v3/files',
    method: 'POST',
    body,
  });
  return { id: res.result.id, name: res.result.name };
}

// --- Internal helpers ---

async function findDefaultFolder(): Promise<string | null> {
  const res = await gapi.client.request<DriveFileList>({
    path: 'https://www.googleapis.com/drive/v3/files',
    params: {
      q: `name='${DEFAULT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
    },
  });
  const files = res.result.files;
  return files.length > 0 ? files[0].id : null;
}

async function createDefaultFolder(): Promise<string> {
  const res = await gapi.client.request<DriveFile>({
    path: 'https://www.googleapis.com/drive/v3/files',
    method: 'POST',
    body: {
      name: DEFAULT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
  });
  return res.result.id;
}

async function getTargetFolderId(): Promise<string> {
  const target = getTargetFolder();
  if (target) return target.id;
  const existing = await findDefaultFolder();
  if (existing) return existing;
  return createDefaultFolder();
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
  const folderId = await getTargetFolderId();
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
  const target = getTargetFolder();
  const folderId = target ? target.id : await findDefaultFolder();
  if (!folderId) return null;

  const fileId = await findFile(folderId);
  if (!fileId) return null;

  const res = await gapi.client.request<WorkInstruction[]>({
    path: `https://www.googleapis.com/drive/v3/files/${fileId}`,
    params: { alt: 'media' },
  });

  return res.result;
}
