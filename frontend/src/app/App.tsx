import { JobsPage } from '@/pages/jobs-page/ui/JobsPage';
import { StoreProvider } from '@/app/providers/StoreProvider';

export function App() {
  return (
    <StoreProvider>
      <JobsPage />
    </StoreProvider>
  );
}
