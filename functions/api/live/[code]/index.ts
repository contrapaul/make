import { HttpError } from '../../_lib/http';
import { doCall, validCode } from '../_lib';

// Public game info (join page, spectators, reconnects).
export const onRequestGet = async (context: any) => {
  const code = String(context.params.code || '').toUpperCase();
  if (!validCode(code)) throw new HttpError(404, 'Game not found.');
  return doCall(context.env, code, 'meta');
};
