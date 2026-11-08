// Classic app endpoint, ported unchanged (see src/legacy/debug.js).
import { runLegacy } from '@/lib/server/legacy-adapter';
import handler from '@/legacy/debug.js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return runLegacy(handler, request);
}
export async function OPTIONS(request: Request) {
  return runLegacy(handler, request);
}
