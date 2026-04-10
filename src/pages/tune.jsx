import { route } from 'preact-router';
import { Shell } from '../components/layout/shell';
import { TuneDetail } from '../components/tune/tune-detail';
import { useTune } from '../hooks/use-tunes';
import { useAuth } from '../lib/auth';

export function TunePage({ id }) {
  const { tune, loading, updateTune } = useTune(id);
  const { user } = useAuth();

  const handleDelete = async () => {
    if (!confirm('Delete this tune from your collection?')) return;
    const { pb } = await import('../lib/pb');
    await pb.collection('user_tunes').delete(id);
    route('/');
  };

  return (
    <Shell>
      {loading ? (
        <p class="text-gray-400 text-center py-12">Loading...</p>
      ) : !tune ? (
        <p class="text-gray-400 text-center py-12">Tune not found.</p>
      ) : (
        <TuneDetail
          tune={tune}
          onUpdate={updateTune}
          onDelete={handleDelete}
          userInstruments={user?.instruments || []}
        />
      )}
    </Shell>
  );
}
