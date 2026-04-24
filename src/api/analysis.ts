import { apiRequest } from './client';
import { ShoeData } from '../models/domain';

export function analyzeShoeImages(images: string[]) {
  return apiRequest<{ success: boolean; result: ShoeData }>('/api/analyze-shoe', {
    method: 'POST',
    body: JSON.stringify({ images }),
  });
}
