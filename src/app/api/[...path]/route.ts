import { handleApiRequest } from '../../../../server/api-handler.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleApiRequest(request);
}
export async function POST(request: Request) {
  return handleApiRequest(request);
}
export async function PUT(request: Request) {
  return handleApiRequest(request);
}
export async function PATCH(request: Request) {
  return handleApiRequest(request);
}
export async function DELETE(request: Request) {
  return handleApiRequest(request);
}
