-- 첨부 파일 저장소. Supabase SQL Editor에서 한 번 실행한다.
-- 규칙: docs/DATA_MODEL.md "첨부 블록", R9. 파일은 attachments/<사용자 id>/<파일 id> 에 두고,
-- 경로 맨 앞 폴더가 내 id인 파일만 올리고, 보고, 지울 수 있다. 버킷은 비공개라 화면은 임시 주소(signed URL)로 연다.

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)  -- 10MB, lib/attachments.ts MAX_ATTACHMENT_BYTES와 같게
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "attachments_select_own" on storage.objects;
drop policy if exists "attachments_insert_own" on storage.objects;
drop policy if exists "attachments_delete_own" on storage.objects;

create policy "attachments_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachments_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachments_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
-- 덮어쓰기(update)는 허용하지 않는다. 파일 id는 매번 새로 만든다.
