import { DashboardSkeleton } from '@/components/ui/Skeleton';

// App Router loading.tsx — shows Quiet Ink skeleton with aria-busy and role="status" via DashboardSkeleton
export default function Loading() {
  return <DashboardSkeleton />;
}
