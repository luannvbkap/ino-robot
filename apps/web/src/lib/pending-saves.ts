/**
 * Các lần lưu bài làm đang gửi dở, theo mã bài làm.
 *
 * Cần vì học sinh có thể rời trang soạn thảo rồi quay lại rất nhanh: lần lưu
 * cuối vừa gửi đi chưa xong mà trang đã tải lại bài — và nhận về bản CŨ. Mở
 * bài thì phải đợi mọi lần lưu của bài đó xong trước.
 */
const pending = new Map<string, Promise<unknown>>();

/** Ghi nhận một lần lưu đang chạy. Trả lại đúng promise đó để dùng tiếp. */
export function trackSave<T>(projectId: string, save: Promise<T>): Promise<T> {
  const previous = pending.get(projectId) ?? Promise.resolve();
  const all = Promise.allSettled([previous, save]);
  pending.set(projectId, all);
  void all.then(() => {
    if (pending.get(projectId) === all) pending.delete(projectId);
  });
  return save;
}

/** Đợi mọi lần lưu của bài làm này xong — thành công hay thất bại đều được */
export async function waitForSaves(projectId: string): Promise<void> {
  await pending.get(projectId);
}
