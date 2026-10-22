import { openDB } from 'idb';
import { z } from 'zod';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { categories, curriculum, initialCourseIds } from './curriculum';

const courseSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1), credits: z.number().min(0).max(100).multipleOf(0.01), category: z.enum(categories.map(c => c.id) as [string, ...string[]]), term: z.string() });
const resourceSchema = z.object({ id: z.string(), name: z.string().min(1), url: z.string().url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol)).optional(), fileId: z.string().optional() }).refine(value => Boolean(value.url) !== Boolean(value.fileId), '资料需要文件或链接');
export const stateSchema = z.object({
  version: z.literal(1),
  courses: z.array(courseSchema),
  semesters: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1) })).min(1),
  folders: z.array(z.object({ id: z.string().min(1), semesterId: z.string(), courseId: z.string(), note: z.string(), resources: z.array(resourceSchema) })),
  completed: z.array(z.string()),
}).superRefine((state, context) => {
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(state.courses.map(c => c.id)) || !unique(state.semesters.map(s => s.id)) || !unique(state.folders.map(f => f.id)) || !unique(state.completed) || !unique(state.folders.map(f => `${f.semesterId}/${f.courseId}`))) context.addIssue({ code: 'custom', message: '备份包含重复记录' });
  if (state.completed.some(id => !state.courses.some(c => c.id === id)) || state.folders.some(f => !state.courses.some(c => c.id === f.courseId) || !state.semesters.some(s => s.id === f.semesterId))) context.addIssue({ code: 'custom', message: '课程或学期关联不完整' });
});
export type State = z.infer<typeof stateSchema>;
export type Folder = State['folders'][number];
export type Resource = Folder['resources'][number];

export function initialState(): State {
  return { version: 1, courses: curriculum, semesters: [{ id: '27-1', name: '27 第一学期' }], folders: initialCourseIds.map(courseId => ({ id: `27-1-${courseId}`, semesterId: '27-1', courseId, note: '', resources: [] })), completed: [] };
}

let database: ReturnType<typeof openDB> | undefined;
const getDb = () => database ??= openDB('gradus', 1, { upgrade(db) { db.createObjectStore('state'); db.createObjectStore('files'); } });
export async function loadState(): Promise<State> {
  const db = await getDb();
  const saved = await db.get('state', 'current');
  if (saved) return stateSchema.parse(saved);
  const state = initialState();
  await db.put('state', state, 'current');
  return state;
}
export async function saveState(state: State, files: { id: string; blob: Blob }[] = []) {
  const validated = stateSchema.parse(state);
  const db = await getDb();
  const tx = db.transaction(['state', 'files'], 'readwrite');
  const retained = new Set(state.folders.flatMap(f => f.resources.flatMap(r => r.fileId ? [r.fileId] : [])));
  for (const key of await tx.objectStore('files').getAllKeys()) if (!retained.has(String(key))) await tx.objectStore('files').delete(key);
  for (const file of files) await tx.objectStore('files').put(file.blob, file.id);
  await tx.objectStore('state').put(validated, 'current');
  await tx.done;
}
export async function getFile(id: string): Promise<Blob> {
  const file = await (await getDb()).get('files', id);
  if (!(file instanceof Blob)) throw new Error('资料文件不存在');
  return file;
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportBackup(state: State) {
  const files: Record<string, Uint8Array> = { 'gradus.json': strToU8(JSON.stringify(state)) };
  for (const folder of state.folders) for (const resource of folder.resources) if (resource.fileId) files[`files/${resource.fileId}`] = new Uint8Array(await (await getFile(resource.fileId)).arrayBuffer());
  download(new Blob([zipSync(files).slice().buffer]), `Gradus-${new Date().toISOString().slice(0, 10)}.zip`);
}
export async function readBackup(file: File) {
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  if (!zip['gradus.json']) throw new Error('备份缺少 gradus.json');
  const state = stateSchema.parse(JSON.parse(strFromU8(zip['gradus.json'])));
  const files = state.folders.flatMap(f => f.resources.filter(r => r.fileId).map(r => {
    const bytes = zip[`files/${r.fileId}`];
    if (!bytes) throw new Error(`备份缺少文件：${r.name}`);
    return { id: r.fileId!, blob: new Blob([bytes.slice().buffer]) };
  }));
  return { state, files };
}
