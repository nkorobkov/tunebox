import { getFileUrl, isImage } from '../../hooks/use-attachments';
import { useConnectivity } from '../../lib/connectivity';

export function SheetMusicViewer({ attachment }) {
  const { isOffline } = useConnectivity();
  const url = getFileUrl(attachment);
  const filename = attachment.file;
  const isPdf = /\.pdf$/i.test(filename);

  if (isOffline) {
    return (
      <div class="text-sm text-gray-400 italic p-4 border border-dashed border-gray-200 rounded text-center">
        Sheet music unavailable offline
      </div>
    );
  }

  if (isImage(filename)) {
    return <img src={url} alt={attachment.label || filename} class="w-full rounded" loading="lazy" />;
  }

  if (isPdf) {
    return (
      <div>
        <iframe src={url} class="w-full h-[600px] border-0 rounded" title={attachment.label || filename} />
        <a href={url} target="_blank" rel="noopener" class="text-xs text-blue-600 hover:underline mt-1 inline-block">
          Open PDF in new tab
        </a>
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener" class="text-sm text-blue-600 hover:underline">
      {attachment.label || filename}
    </a>
  );
}
