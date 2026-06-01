import {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  getMaterials,
  getMaterialsByChapter,
  deleteMaterial,
  deleteMaterialFile,
} from '../lib/db';
import type { Subject, Chapter, Material } from '../lib/types';

export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

function err(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export async function fetchSubjects(userId: string): Promise<ServiceResult<Subject[]>> {
  try {
    return { data: await getSubjects(userId), error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to load subjects') };
  }
}

export async function fetchSubject(id: string): Promise<ServiceResult<Subject>> {
  try {
    const data = await getSubject(id);
    if (!data) return { data: null, error: 'Subject not found' };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to load subject') };
  }
}

export async function addSubject(
  userId: string,
  name: string,
  description?: string,
  color?: string,
  emoji?: string,
): Promise<ServiceResult<Subject>> {
  try {
    const data = await createSubject(userId, name, description, color, emoji);
    if (!data) return { data: null, error: 'Failed to create subject' };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to create subject') };
  }
}

export async function editSubject(
  id: string,
  updates: Partial<Pick<Subject, 'name' | 'description' | 'color' | 'emoji'>>,
): Promise<ServiceResult<void>> {
  try {
    await updateSubject(id, updates);
    return { data: undefined, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to update subject') };
  }
}

export async function removeSubject(id: string): Promise<ServiceResult<void>> {
  try {
    await deleteSubject(id);
    return { data: undefined, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to delete subject') };
  }
}

export async function fetchChapters(subjectId: string): Promise<ServiceResult<Chapter[]>> {
  try {
    return { data: await getChapters(subjectId), error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to load chapters') };
  }
}

export async function addChapter(
  subjectId: string,
  name: string,
  description?: string,
  orderIndex?: number,
): Promise<ServiceResult<Chapter>> {
  try {
    const data = await createChapter(subjectId, name, description, orderIndex);
    if (!data) return { data: null, error: 'Failed to create chapter' };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to create chapter') };
  }
}

export async function editChapter(
  id: string,
  updates: Partial<Pick<Chapter, 'name' | 'description' | 'order_index'>>,
): Promise<ServiceResult<void>> {
  try {
    await updateChapter(id, updates);
    return { data: undefined, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to update chapter') };
  }
}

export async function removeChapter(id: string): Promise<ServiceResult<void>> {
  try {
    await deleteChapter(id);
    return { data: undefined, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to delete chapter') };
  }
}

export async function fetchMaterials(subjectId: string): Promise<ServiceResult<Material[]>> {
  try {
    return { data: await getMaterials(subjectId), error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to load materials') };
  }
}

export async function fetchMaterialsByChapter(chapterId: string): Promise<ServiceResult<Material[]>> {
  try {
    return { data: await getMaterialsByChapter(chapterId), error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to load materials') };
  }
}

export async function removeMaterial(
  id: string,
  fileUrl: string,
): Promise<ServiceResult<void>> {
  try {
    await deleteMaterialFile(fileUrl);
    await deleteMaterial(id);
    return { data: undefined, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to delete material') };
  }
}
