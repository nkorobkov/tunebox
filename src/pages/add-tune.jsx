import { route } from 'preact-router';
import { Shell } from '../components/layout/shell';
import { TuneForm } from '../components/tune/tune-form';
import { useTunes } from '../hooks/use-tunes';

export function AddTunePage() {
  const { createTune } = useTunes();

  const handleSubmit = async (data) => {
    const record = await createTune({
      ...data,
      labels: [],
      instruments: {},
    });
    route(`/tune/${record.id}`);
  };

  return (
    <Shell>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Add Tune</h1>
      <div class="max-w-2xl">
        <TuneForm onSubmit={handleSubmit} submitLabel="Add to Collection" />
      </div>
    </Shell>
  );
}
