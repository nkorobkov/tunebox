import { useAbcRender } from '../../hooks/use-abc-render';

export function AbcViewer({ abc }) {
  const { ref } = useAbcRender(abc);

  if (!abc) {
    return <p class="text-gray-400 italic">No ABC notation available</p>;
  }

  return <div ref={ref} class="abc-viewer" />;
}
