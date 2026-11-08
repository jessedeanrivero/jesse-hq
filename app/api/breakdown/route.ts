// Classic app endpoint, ported unchanged (see src/legacy/breakdown.js). Used only by /classic.
import { runLegacy } from '@/lib/server/legacy-adapter';
import handler from '@/legacy/breakdown.js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return runLegacy(handler, request);
}
export async function OPTIONS(request: Request) {
  return runLegacy(handler, request);
}
export async function GET(request: Request) {
  return runLegacy(handler, request);
}
