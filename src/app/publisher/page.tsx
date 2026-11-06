import { PublisherDashboard } from '@/components/publisher/PublisherDashboard';

export const metadata = { title: 'Publishing dashboard · BlockRush', description: 'BlockRush clip queue, publishing history and worker status.' };

export default function PublisherPage() {
  return <PublisherDashboard />;
}
