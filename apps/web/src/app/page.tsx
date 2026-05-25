import { redirect } from 'next/navigation';

export default function Home(): never {
  // Root route lands users on the marketing page; dashboard requires auth.
  redirect('/landing');
}
