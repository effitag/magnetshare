// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createCloudRepo } from '@/features/studio/storage/cloudRepo';
import { assetFileName, frameFolder, imageTypeOf, isFrameObjectPath } from '@/features/studio/storage/paths';
import { isNetworkError } from '@/features/studio/storage/errors';
import { createMemoryGateway } from '@/features/studio/storage/memoryGateway';

const png = (name = 'logo.png', type = 'image/png') => new File([new Uint8Array([137, 80, 78, 71])], name, { type });

describe('storage paths', () => {
  it('keeps every file of a template under its id (one library shared by all admins)', () => {
    expect(frameFolder('t1')).toBe('frames/t1');
  });

  it('turns any file name into a safe ASCII storage name', () => {
    expect(assetFileName('leaf.SVG', 'image/svg+xml')).toBe('leaf.svg');
    expect(assetFileName('לוגו.png', 'image/png')).toBe('image.png');
    expect(assetFileName('Noa & Itai (final).jpeg', 'image/jpeg')).toBe('Noa-Itai-final.jpg');
    expect(assetFileName('café.png', 'image/png')).toBe('cafe.png');
  });

  it('avoids names already taken in the folder', () => {
    expect(assetFileName('logo.png', 'image/png', ['logo.png', 'LOGO-2.png'])).toBe('logo-3.png');
  });

  it('allows overlay, preview, and the camera screen file only', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(isFrameObjectPath(`frames/${id}/overlay.png`)).toBe(true);
    expect(isFrameObjectPath(`frames/${id}/preview.png`)).toBe(true);
    expect(isFrameObjectPath(`frames/${id}/screen.webp`)).toBe(true);
    expect(isFrameObjectPath(`frames/${id}/logo.png`)).toBe(false);
    expect(isFrameObjectPath(`frames/${id}/screen.png`)).toBe(false);
  });

  it('accepts only PNG, JPG, WEBP and SVG', () => {
    expect(() => assetFileName('a.gif', 'image/gif')).toThrow(/Unsupported/);
    expect(imageTypeOf('photo.JPG', '')).toBe('image/jpeg');
    expect(imageTypeOf('doc.pdf', 'application/pdf')).toBeNull();
  });
});

describe('cloud repo', () => {
  let gateway;
  let repo;
  beforeEach(() => {
    gateway = createMemoryGateway();
    repo = createCloudRepo(gateway);
  });

  it('creates a template and lists it with its size, newest first', async () => {
    const a = await repo.create('ראשונה');
    const b = await repo.create('שנייה');
    expect(a.revision).toBe(1);
    const list = await repo.list();
    expect(list.map((t) => t.name)).toEqual(['שנייה', 'ראשונה']);
    expect(list[0]).toMatchObject({ id: b.id, size: { widthMm: 100, heightMm: 75 }, thumbnailUrl: null });
  });

  it('loads the document with its revision', async () => {
    const { id } = await repo.create('חתונה');
    const { doc, revision } = await repo.load(id);
    expect(doc.name).toBe('חתונה');
    expect(doc.elements[0].type).toBe('background');
    expect(revision).toBe(1);
  });

  it('saves with the expected revision and returns the next one', async () => {
    const { id, doc } = await repo.create('חתונה');
    const next = await repo.save(id, { ...doc, name: 'חתונה 2' }, 1);
    expect(next).toBe(2);
    const row = gateway.rows.get(id);
    expect(row.name).toBe('חתונה 2');
    expect(row.doc.name).toBe('חתונה 2');
    expect(row.doc.updatedAt).toBeTruthy();
  });

  it('refuses to overwrite a newer save from another tab or computer', async () => {
    const { id, doc } = await repo.create('חתונה');
    await repo.save(id, { ...doc, name: 'מהמחשב השני' }, 1);
    await expect(repo.save(id, { ...doc, name: 'מהמחשב הזה' }, 1)).rejects.toMatchObject({ name: 'ConflictError', latestRevision: 2 });
    expect(gateway.rows.get(id).name).toBe('מהמחשב השני');
  });

  it('reports a template deleted meanwhile', async () => {
    const { id, doc } = await repo.create('חתונה');
    await repo.remove(id);
    await expect(repo.save(id, doc, 1)).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(repo.load(id)).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('renames in both the list and the document', async () => {
    const { id } = await repo.create('ישן');
    await repo.rename(id, 'חדש');
    const { doc, revision } = await repo.load(id);
    expect(doc.name).toBe('חדש');
    expect(revision).toBe(2);
    expect((await repo.list())[0].name).toBe('חדש');
  });

  it('keeps logos in the document and never stores them as frame files', async () => {
    const { id } = await repo.create('חתונה');
    const first = await repo.uploadAsset(id, png('לוגו.png'));
    const second = await repo.uploadAsset(id, png('לוגו.png'));
    expect(first.startsWith('data:image/png;base64,')).toBe(true);
    expect(second.startsWith('data:image/png;base64,')).toBe(true);
    expect(gateway.files.size).toBe(0);
    expect(await repo.readAsset(id, first)).toBeInstanceOf(Blob);
    await expect(repo.uploadAsset(id, png('anim.gif', 'image/gif'))).rejects.toMatchObject({ name: 'UnsupportedImageError' });
  });

  it('stores the preview at frames/{id}/preview.png', async () => {
    const { id } = await repo.create('חתונה');
    await repo.saveThumbnail(id, new Blob(['png']));
    await repo.saveThumbnail(id, new Blob(['png 2']));
    expect((await repo.list())[0].thumbnailUrl).toBe(`memory://frames/${id}/preview.png`);
    expect([...gateway.files.keys()]).toEqual([`frames/${id}/preview.png`]);
  });

  it('deletes only that frame preview when the frame is deleted', async () => {
    const { id } = await repo.create('חתונה');
    const other = await repo.create('אחרת');
    await repo.saveThumbnail(id, new Blob(['png']));
    await repo.saveThumbnail(other.id, new Blob(['png']));
    expect(await repo.listFiles(id)).toEqual(['preview.png']);

    await repo.remove(id);
    expect(gateway.rows.has(id)).toBe(false);
    expect([...gateway.files.keys()]).toEqual([`frames/${other.id}/preview.png`]);
  });

  it('writes the print file and the camera file, and unpublish leaves both in place', async () => {
    const template = await repo.create('חתונה');
    const event = await repo.duplicateForEvent(template.id);
    await expect(repo.publish(template.id, { overlay: new Blob(['o']), screen: new Blob(['s']) })).rejects.toThrow(/template_not_publishable/);
    await repo.publish(event.id, { overlay: new Blob(['overlay']), screen: new Blob(['screen']) });
    expect(gateway.files.get(`frames/${event.id}/overlay.png`).contentType).toBe('image/png');
    expect(gateway.files.get(`frames/${event.id}/screen.webp`).contentType).toBe('image/webp');
    expect(gateway.rows.get(event.id).is_published).toBe(true);
    await repo.unpublish(event.id);
    expect(gateway.rows.get(event.id).is_published).toBe(false);
    expect([...gateway.files.keys()].sort()).toEqual([
      `frames/${event.id}/overlay.png`,
      `frames/${event.id}/screen.webp`,
    ]);
  });

  it('makes a portrait event frame from a landscape template', async () => {
    const template = await repo.create('חתונה');
    const portrait = await repo.duplicateForEvent(template.id, 'portrait');
    const row = gateway.rows.get(portrait.id);
    expect(row.is_template).toBe(false);
    expect(row.height_mm).toBeGreaterThan(row.width_mm);
  });

  it('turns a dropped connection into a network error the editor can recognise', async () => {
    gateway.offline = true;
    const err = await repo.list().catch((e) => e);
    expect(isNetworkError(err)).toBe(true);
  });
});
