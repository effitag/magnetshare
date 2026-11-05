import { frameGateway } from '@/services/api';
import { createCloudRepo } from './storage/cloudRepo';

let repo = null;

export function useStudioRepo() {
  repo ??= createCloudRepo(frameGateway);
  return repo;
}

export const STUDIO_FONT = 'font-[Rubik,sans-serif]';
