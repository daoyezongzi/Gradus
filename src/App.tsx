import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronDown, FileText, FolderClosed, Link as LinkIcon, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import { categories, creditSum, electiveModules, progress, type Course } from './curriculum';
import { download, exportBackup, getFile, readBackup, saveState, type Folder, type State } from './store';

type Modal = 'add' | 'semester' | 'settings' | 'link' | 'edit' | null;
function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} onCancel={close} onClick={event => { if (event.target === ref.current) close(); }}><div className="dialog-inner"><header><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={close}><X size={20} /></button></header>{children}</div></dialog>;
}

export function App({ initial }: { initial: State }) {
  const [state, setState] = useState(initial);
  const [page, setPage] = useState(location.hash === '#credits' ? 'credits' : 'courses');
  const [semesterId, setSemesterId] = useState(initial.semesters[0].id);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [addMode, setAddMode] = useState('catalog');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [restore, setRestore] = useState<Awaited<ReturnType<typeof readBackup>> | null>(null);
  const folder = state.folders.find(f => f.id === folderId);
  const course = state.courses.find(c => c.id === folder?.courseId);
  const semester = state.semesters.find(s => s.id === semesterId)!;
  const semesterFolders = state.folders.filter(f => f.semesterId === semesterId);
  const summary = progress(state.courses, state.completed);
  const fileInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const change = () => { setPage(location.hash === '#credits' ? 'credits' : 'courses'); setFolderId(null); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);

  async function commit(next: State, files: { id: string; blob: Blob }[] = []) {
    setBusy(true);
    await saveState(next, files);
    setState(next); setBusy(false);
  }
  function openAdd() { setSelected([]); setCatalogQuery(''); setCategoryFilter(''); setAddMode('catalog'); setModal('add'); }
  async function addCourses(ids: string[], courses = state.courses) {
    const existing = new Set(semesterFolders.map(f => f.courseId));
    const folders = ids.filter(id => !existing.has(id)).map(courseId => ({ id: crypto.randomUUID(), semesterId, courseId, note: '', resources: [] }));
    await commit({ ...state, courses, folders: [...state.folders, ...folders] });
    setModal(null); setNotice(`已添加 ${folders.length} 门课程`);
  }
  async function updateFolder(next: Folder) {
    await commit({ ...state, folders: state.folders.map(f => f.id === next.id ? next : f) });
  }
  async function upload(files: FileList | File[]) {
    if (!folder || !files.length) return;
    const added = Array.from(files).map(file => ({ file, id: crypto.randomUUID() }));
    await commit({ ...state, folders: state.folders.map(f => f.id === folder.id ? { ...f, resources: [...f.resources, ...added.map(({ file, id }) => ({ id, fileId: id, name: file.name }))] } : f) }, added.map(({ file, id }) => ({ id, blob: file })));
    setNotice('资料已保存');
  }
  async function submitCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get('name')).trim();
    if (!name) return;
    const nextCourse = { id: course && modal === 'edit' ? course.id : crypto.randomUUID(), name, credits: Number(values.get('credits')), category: String(values.get('category')), term: course && modal === 'edit' ? course.term : '' };
    if (modal === 'edit') {
      await commit({ ...state, courses: state.courses.map(c => c.id === nextCourse.id ? nextCourse : c) }); setModal(null);
    } else {
      if (state.courses.some(c => c.name === name) && !confirm('已有同名课程，仍然创建新课程？')) return;
      await addCourses([nextCourse.id], [...state.courses, nextCourse]);
    }
  }
  function courseForm(edit?: Course) {
    return <form onSubmit={submitCustom} className="form-fields"><label>课程名称<input name="name" required maxLength={120} defaultValue={edit?.name} /></label><div className="form-pair"><label>学分<input name="credits" type="number" required min="0" max="100" step="0.01" defaultValue={edit?.credits} /></label><label>所属分类<select name="category" defaultValue={edit?.category ?? 'other'}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><footer><button className="primary" disabled={busy}>{edit ? '保存修改' : '添加到学期'}</button></footer></form>;
  }

  return <div className="app-shell" aria-busy={busy}>
    <header className="site-header"><a className="brand" href="#courses" aria-label="Gradus 首页"><span className="brand-mark"><i /><i /><i /></span>Gradus<span className="brand-caption">学有所积</span></a><nav aria-label="主要导航"><a href="#courses" aria-current={page === 'courses' ? 'page' : undefined}>课程</a><a href="#credits" aria-current={page === 'credits' ? 'page' : undefined}>学分</a></nav><button className="icon-button settings" aria-label="数据与设置" onClick={() => setModal('settings')}><Settings2 size={18} /></button></header>
    <main>
      {page === 'courses' ? <div className="course-workspace">
        <aside className="semester-sidebar"><div className="sidebar-heading"><span>我的学期</span><button className="icon-button" aria-label="新建学期" onClick={() => setModal('semester')}><Plus size={17} /></button></div><div className="semester-list">{state.semesters.map(s => <button key={s.id} className={semesterId === s.id ? 'semester active' : 'semester'} onClick={() => { setSemesterId(s.id); setFolderId(null); setQuery(''); }}><FolderClosed size={17} /><span>{s.name}</span></button>)}</div><p className="sidebar-foot">一步一程，自有所得。</p></aside>
        <section className="workspace-main">
          {folder && course ? <>
            <button className="back-link" onClick={() => setFolderId(null)}><ArrowLeft size={15} />{semester.name}</button>
            <header className="page-heading"><div><p className="eyebrow">COURSE MATERIALS</p><h1>{course.name}</h1><p className="subtitle">{course.credits} 学分<span className="separator">/</span>{categories.find(c => c.id === course.category)?.name}</p></div><button className="text-button" onClick={() => setModal('edit')}>编辑课程</button></header>
            <div className="section-bar"><h2>复习资料 <span className="count">{folder.resources.length}</span></h2><div className="actions"><button className="text-button" onClick={() => setModal('link')}><LinkIcon size={15} />添加链接</button><button className="primary" disabled={busy} onClick={() => fileInput.current!.click()}><Plus size={16} />上传文件</button></div></div>
            <input ref={fileInput} type="file" multiple hidden onChange={async e => { if (e.target.files) await upload(e.target.files); e.target.value = ''; }} />
            <div className="resource-area" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files); }}>
              {folder.resources.length ? folder.resources.map(resource => <div className="resource-row" key={resource.id}>{resource.url ? <LinkIcon size={19} /> : <FileText size={19} />}<div className="resource-name">{resource.url ? <a href={resource.url} target="_blank" rel="noreferrer">{resource.name}<ArrowUpRight size={14} /></a> : <button className="text-button" onClick={async () => download(await getFile(resource.fileId!), resource.name)}>{resource.name}</button>}</div><button className="icon-button" aria-label={`删除资料 ${resource.name}`} disabled={busy} onClick={async () => { if (confirm(`删除资料“${resource.name}”？`)) await updateFolder({ ...folder, resources: folder.resources.filter(r => r.id !== resource.id) }); }}><Trash2 size={15} /></button></div>) : <button className="empty-state upload-empty" onClick={() => fileInput.current!.click()}><BookOpen size={32} strokeWidth={1.2} /><strong>把复习资料放在这里</strong><span>点击上传，或将文件拖入此处</span></button>}
            </div>
            <details className="notes"><summary>课程备注<ChevronDown size={15} /></summary><form key={folder.id + folder.note} onSubmit={async e => { e.preventDefault(); await updateFolder({ ...folder, note: String(new FormData(e.currentTarget).get('note')) }); setNotice('备注已保存'); }}><textarea name="note" aria-label="课程备注" defaultValue={folder.note} rows={4} placeholder="记录需要补充的资料…" /><button className="text-button" disabled={busy}>保存备注</button></form></details>
          </> : <>
            <header className="page-heading"><div><p className="eyebrow">MY COURSES</p><h1>{semester.name}</h1><p className="subtitle">{semesterFolders.length} 门课程<span className="separator">/</span>{creditSum(state.courses.filter(c => semesterFolders.some(f => f.courseId === c.id)))} 学分</p></div><button className="primary" onClick={openAdd}><Plus size={17} />添加课程</button></header>
            <div className="list-tools"><label className="search-box"><Search size={16} /><input aria-label="搜索本学期课程" placeholder="搜索课程" value={query} onChange={e => setQuery(e.target.value)} /></label><button className="text-button quiet" onClick={() => setModal('semester')}>管理学期</button></div>
            <table className="course-table"><thead><tr><th>课程名称</th><th>学分</th><th>复习资料</th></tr></thead><tbody>{semesterFolders.filter(f => state.courses.find(c => c.id === f.courseId)!.name.toLowerCase().includes(query.toLowerCase())).map(f => { const c = state.courses.find(c => c.id === f.courseId)!; return <tr key={f.id}><td><button onClick={() => setFolderId(f.id)}><FolderClosed size={19} strokeWidth={1.4} /><span>{c.name}</span></button></td><td>{c.credits}</td><td><button className={f.resources.length ? 'material-state available' : 'material-state'} aria-label={`${c.name}复习资料`} onClick={() => setFolderId(f.id)}>{f.resources.length ? <><Check size={13} />有资料</> : '暂无'}</button></td></tr>; })}</tbody></table>
            {semesterFolders.every(f => !state.courses.find(c => c.id === f.courseId)!.name.toLowerCase().includes(query.toLowerCase())) && <div className="empty-state"><FolderClosed size={30} /><strong>{query ? '没有找到课程' : '这个学期，从一门课程开始'}</strong>{!query && <button className="text-button" onClick={openAdd}>添加课程</button>}</div>}
          </>}
        </section>
      </div> : <section className="credits-page"><header className="page-heading"><div><p className="eyebrow">ACADEMIC PROGRESS</p><h1>学分</h1><p className="subtitle">2025 级 · 金融学（量化金融）</p></div></header><div className="credit-overview"><div><span>毕业学分</span><p><strong>{summary.graduation}</strong><span>/ 157.5</span></p><progress value={Math.min(summary.graduation, 157.5)} max={157.5} /></div><div><span>第二课堂</span><p><strong>{summary.byCategory.second}</strong><span>/ 6</span></p><progress value={Math.min(summary.byCategory.second, 6)} max={6} /></div></div><div className="credit-labels"><span>培养要求</span><span>已修 / 要求</span></div>
        {['通识必修', '通识选修', '学科基础课程', '专业课程', '第二课堂', '先修课程', '其他课程'].map(group => { const children = categories.filter(c => c.group === group); const required = group === '通识选修' ? 10 : children.reduce((sum, c) => sum + c.required, 0); const earned = children.reduce((sum, c) => sum + summary.byCategory[c.id], 0); return <details className="credit-group" key={group}><summary><span><ChevronDown size={16} />{group}</span><span className="numeric">{earned}<span className="quiet"> / {required}</span></span></summary>
          {group === '通识选修' && <div className="elective-rules"><span className={summary.byCategory.art >= 1 ? 'done' : ''}>艺术修养 {summary.byCategory.art >= 1 ? '已完成' : '至少一门'}</span><span className={summary.byCategory.innovation >= 1 ? 'done' : ''}>创新创业 {summary.byCategory.innovation >= 1 ? '已完成' : '至少一门'}</span><span className={summary.covered >= 3 ? 'done' : ''}>其他五个模块 {summary.covered} / 3</span></div>}
          {children.map(category => <details className="category" key={category.id}><summary><span>{category.name}{electiveModules.includes(category.id) && <small>任选三个模块</small>}</span><span>{summary.byCategory[category.id]}<span className="quiet"> / {category.required}</span></span></summary><div className="credit-courses">{category.id === 'cross' && <p className="quiet">最低 4 学分，具体认定以学校修读规定为准。</p>}{state.courses.filter(c => c.category === category.id).map(c => <label key={c.id}><input type="checkbox" aria-label={`已修 ${c.name}`} checked={state.completed.includes(c.id)} disabled={busy} onChange={async e => { await commit({ ...state, completed: e.target.checked ? [...state.completed, c.id] : state.completed.filter(id => id !== c.id) }); }} /><span>{c.name}</span><span>{c.credits}</span></label>)}{!state.courses.some(c => c.category === category.id) && <p className="quiet">添加课程时选择此分类，即可在这里记录学分。</p>}</div></details>)}
        </details>; })}<p className="credit-footnote">勾选已修课程后自动统计学分。必修课程需逐门完成，通识选修需同时满足模块要求。</p></section>}
    </main>
    <footer className="site-footer"><span>GRADUS <span className="footer-dot">·</span> 每一步，都算数。</span><span>保存在此浏览器</span></footer>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
    {modal === 'add' && <Dialog title="添加课程" close={() => setModal(null)}><div className="tabs"><button className={addMode === 'catalog' ? 'selected' : ''} onClick={() => setAddMode('catalog')}>从培养计划添加</button><button className={addMode === 'custom' ? 'selected' : ''} onClick={() => setAddMode('custom')}>自己添加课程</button></div>{addMode === 'custom' ? courseForm() : <><div className="catalog-filters"><input aria-label="搜索培养计划" placeholder="课程名称或编号" value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} /><select aria-label="筛选课程分类" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="">全部分类</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="catalog-list">{state.courses.filter(c => (!categoryFilter || c.category === categoryFilter) && `${c.name}${c.id}`.toLowerCase().includes(catalogQuery.toLowerCase())).map(c => { const exists = semesterFolders.some(f => f.courseId === c.id); return <label key={c.id} className={exists ? 'disabled' : ''}><input type="checkbox" disabled={exists} checked={exists || selected.includes(c.id)} onChange={e => setSelected(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))} /><span>{c.name}<small>{categories.find(category => category.id === c.category)?.name}{exists ? ' · 已添加' : ''}</small></span><span>{c.credits}</span></label>; })}</div><footer className="dialog-footer"><span>已选 {selected.length} 门 · {creditSum(state.courses.filter(c => selected.includes(c.id)))} 学分</span><button className="primary" disabled={busy || !selected.length} onClick={() => addCourses(selected)}>添加到学期</button></footer></>}</Dialog>}
    {modal === 'semester' && <Dialog title="管理学期" close={() => setModal(null)}><form className="form-fields" onSubmit={async e => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get('name')).trim(); if (!name) return; const id = crypto.randomUUID(); await commit({ ...state, semesters: [...state.semesters, { id, name }] }); setSemesterId(id); setFolderId(null); setModal(null); }}><label>新学期名称<input name="name" required maxLength={50} placeholder="例如：27 第二学期" /></label><button className="primary" disabled={busy}>新建学期</button></form><div className="semester-management">{state.semesters.map(s => <form key={s.id} onSubmit={async e => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get('name')).trim(); if (!name) return; await commit({ ...state, semesters: state.semesters.map(item => item.id === s.id ? { ...item, name } : item) }); setNotice('学期名称已保存'); }}><input aria-label={`学期名称 ${s.name}`} name="name" defaultValue={s.name} required maxLength={50} /><button className="text-button" disabled={busy}>保存</button><button type="button" className="icon-button" aria-label={`删除学期 ${s.name}`} disabled={busy || state.semesters.length === 1} onClick={async () => { const count = state.folders.filter(f => f.semesterId === s.id).length; if (!confirm(`删除“${s.name}”及其中 ${count} 个课程文件夹和资料？已修学分记录会保留。`)) return; const semesters = state.semesters.filter(item => item.id !== s.id); await commit({ ...state, semesters, folders: state.folders.filter(f => f.semesterId !== s.id) }); if (semesterId === s.id) { setSemesterId(semesters[0].id); setFolderId(null); } }}><Trash2 size={15} /></button></form>)}</div></Dialog>}
    {modal === 'edit' && course && folder && <Dialog title="编辑课程" close={() => setModal(null)}>{courseForm(course)}<label className="move-label">所属学期<select value={folder.semesterId} disabled={busy} onChange={async e => { const id = e.target.value; await updateFolder({ ...folder, semesterId: id }); setSemesterId(id); }} >{state.semesters.map(s => <option key={s.id} value={s.id} disabled={state.folders.some(f => f.id !== folder.id && f.semesterId === s.id && f.courseId === course.id)}>{s.name}</option>)}</select></label><button className="danger-button" disabled={busy} onClick={async () => { if (!confirm(`删除本学期“${course.name}”文件夹及 ${folder.resources.length} 项资料？已修学分记录会保留。`)) return; await commit({ ...state, folders: state.folders.filter(f => f.id !== folder.id) }); setFolderId(null); setModal(null); }}>删除课程文件夹</button></Dialog>}
    {modal === 'link' && folder && <Dialog title="添加资料链接" close={() => setModal(null)}><form className="form-fields" onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); const url = String(data.get('url')); const name = String(data.get('name')).trim(); if (!name) return; if (!['https:', 'http:'].includes(new URL(url).protocol)) { setNotice('请填写 http 或 https 链接'); return; } await updateFolder({ ...folder, resources: [...folder.resources, { id: crypto.randomUUID(), name, url }] }); setModal(null); }}><label>资料名称<input name="name" required /></label><label>链接地址<input name="url" type="url" required placeholder="https://" /></label><footer><button className="primary" disabled={busy}>保存链接</button></footer></form></Dialog>}
    {modal === 'settings' && <Dialog title="数据与设置" close={() => { setModal(null); setRestore(null); }}><p className="settings-note">课程、学分和上传文件保存在当前浏览器。导出备份可将全部数据保存到电脑。</p><div className="backup-actions"><button className="primary" disabled={busy} onClick={() => exportBackup(state)}><ArrowDownToLine size={16} />导出完整备份</button><button className="secondary" onClick={() => backupInput.current!.click()}>导入备份</button></div><input ref={backupInput} hidden type="file" accept=".zip" onChange={async e => { if (e.target.files?.[0]) setRestore(await readBackup(e.target.files[0])); e.target.value = ''; }} />{restore && <div className="restore-confirm"><p>{restore.state.semesters.length} 个学期 · {restore.state.folders.length} 个课程文件夹 · {restore.files.length} 个文件</p><p>导入后替换当前数据。</p><button className="primary" disabled={busy} onClick={async () => { await commit(restore.state, restore.files); setSemesterId(restore.state.semesters[0].id); setFolderId(null); setRestore(null); setModal(null); setNotice('备份已恢复'); }}>确认恢复</button></div>}<div className="source-note"><h3>培养计划</h3><p>2025 金融学（量化金融） · 毕业学分 157.5</p><p>初始课程依据提供的课表。“体育”对应体育Ⅲ，可在课程详情中调整。</p></div></Dialog>}
  </div>;
}
