export function LoadingIndicator({ text = 'Loading' }) {
  return (
    <div class="flex flex-col items-center justify-center py-12 gap-3">
      <img src="/tunebox-spinner.svg" alt="" class="loading-spinner w-10 h-10" />
      <p class="text-gray-400">{text}...</p>
    </div>
  );
}
