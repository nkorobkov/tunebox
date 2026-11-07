import { route } from 'preact-router';
import { Shell } from '../components/layout/shell';
import { TuneDetail } from '../components/tune/tune-detail';
import { LoadingIndicator } from '../components/loading-indicator';
import { useTune } from '../hooks/use-tunes';
import { useAuth } from '../lib/auth';
import { pb } from '../lib/pb';

export function TunePage({ id }) {
  const { tune, loading, updateTune } = useTune(id);
  const { user } = useAuth();

  // An instrument added to this tune via "Other..." joins the profile's list too,
  // so practice (which only offers profile instruments) can use it. The SDK
  // updates the auth store with the returned record, which refreshes `user`.
  const handleAddInstrumentToProfile = async (name) => {
    const current = pb.authStore.record?.instruments || [];
    if (current.includes(name)) return;
    await pb.collection('users').update(user.id, { instruments: [...current, name] });
  };

  const handleDelete = async () => {
    await pb.collection('user_tunes').delete(id);
    route('/');
  };

  return (
    <Shell>
      {loading ? (
        <LoadingIndicator />
      ) : !tune ? (
        <p class="text-gray-400 text-center py-12">Tune not found.</p>
      ) : (
        <TuneDetail
          tune={tune}
          onUpdate={updateTune}
          onDelete={handleDelete}
          userInstruments={user?.instruments || []}
          onAddInstrumentToProfile={handleAddInstrumentToProfile}
        />
      )}
    </Shell>
  );
}
