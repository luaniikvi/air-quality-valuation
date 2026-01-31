export default function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
      <div className="font-semibold">Có lỗi xảy ra</div>
      <div className="text-sm mt-1">{message}</div>
    </div>
  );
}
